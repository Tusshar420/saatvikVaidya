import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_LABEL_SPEC,
  MAX_LABEL_LIMIT,
  defaultLabelValues,
  descriptionSources,
  effectiveLabelValues,
  labelFields,
  labelProblems,
  logoPlacements,
  overridesFor,
  specFields,
  tidyLabelText,
  type LabelField,
  type LabelOverrides,
  type LabelProblem,
  type LabelProfile,
  type LabelSnapshot,
  type LabelSpecData,
  type LabelValues,
} from "@/lib/label";
import { db } from "@/server/db";

// Per-product label details of a Launch cart line. The spec of the product
// says what its label can print; the brand profile gives the defaults, fitted
// to the spec; the line's overrides (saved on the cart line) change single
// fields for that one product without touching the profile. When the order
// is placed the label as it stands is saved with the order line.

const limitsSchema = z.partialRecord(z.enum(labelFields), z.number().int().min(1).max(MAX_LABEL_LIMIT));
const overridesSchema = z.partialRecord(z.enum(labelFields), z.string().max(MAX_LABEL_LIMIT));

const specSelect = {
  key: true,
  name: true,
  widthMm: true,
  heightMm: true,
  logoWidthMm: true,
  logoHeightMm: true,
  logoPlacement: true,
  descriptionSource: true,
  limits: true,
} satisfies Prisma.LabelSpecSelect;

type SpecRow = Prisma.LabelSpecGetPayload<{ select: typeof specSelect }>;

/** A spec row as the pages use it; a row with unreadable limits falls back to the general spec. */
export function toLabelSpec(row: SpecRow | null): LabelSpecData {
  if (!row) return DEFAULT_LABEL_SPEC;
  const limits = limitsSchema.safeParse(row.limits);
  if (!limits.success || !(descriptionSources as readonly string[]).includes(row.descriptionSource)) {
    return DEFAULT_LABEL_SPEC;
  }
  const placement = row.logoPlacement.replace("_", "-");
  return {
    key: row.key,
    name: row.name,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    logo: {
      widthMm: row.logoWidthMm,
      heightMm: row.logoHeightMm,
      placement: (logoPlacements as readonly string[]).includes(placement)
        ? (placement as (typeof logoPlacements)[number])
        : "top-left",
    },
    descriptionSource: row.descriptionSource,
    limits: limits.data,
  };
}

/** The spec fields as stored (for the admin product form's choice). */
export async function listLabelSpecs(): Promise<LabelSpecData[]> {
  const rows = await db.labelSpec.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: specSelect });
  return rows.map(toLabelSpec);
}

export type LabelLine = {
  productId: number;
  name: string;
  spec: LabelSpecData;
  /** The label as it starts: the profile fitted to the spec. */
  defaults: LabelValues;
  /** Fields whose profile text was shortened to fit. */
  trimmed: LabelField[];
  /** What the user changed for this product. */
  overrides: LabelOverrides;
  /** The label as it will print. */
  values: LabelValues;
  /** Fields over the spec's limit. */
  problems: LabelProblem[];
};

const lineSelect = {
  productId: true,
  labelOverrides: true,
  product: {
    select: {
      name: true,
      ingredients: true,
      dosage: true,
      labelSpec: { select: specSelect },
    },
  },
} satisfies Prisma.BrandCartItemSelect;

function toLabelLine(
  row: Prisma.BrandCartItemGetPayload<{ select: typeof lineSelect }>,
  profile: LabelProfile,
): LabelLine {
  const spec = toLabelSpec(row.product.labelSpec);
  const { values: defaults, trimmed } = defaultLabelValues(profile, row.product, spec);
  const parsed = overridesSchema.safeParse(row.labelOverrides ?? {});
  const overrides: LabelOverrides = {};
  if (parsed.success) {
    // Only fields this spec prints count; a spec change can drop one.
    for (const field of specFields(spec)) {
      const value = parsed.data[field];
      if (value !== undefined) overrides[field] = value;
    }
  }
  const values = effectiveLabelValues(defaults, overrides, spec);
  return {
    productId: row.productId,
    name: row.product.name,
    spec,
    defaults,
    trimmed,
    overrides,
    values,
    problems: labelProblems(values, spec),
  };
}

/** The label of every product in the user's Launch cart, for `profile`. Oldest line first. */
export async function readLabelLines(
  userId: string,
  profile: LabelProfile,
  client: Prisma.TransactionClient = db,
): Promise<LabelLine[]> {
  const rows = await client.brandCartItem.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: lineSelect,
  });
  return rows.map((row) => toLabelLine(row, profile));
}

/** What an order line keeps: the spec, the label as approved and which fields were changed. */
export function labelSnapshot(line: LabelLine): LabelSnapshot {
  const { spec } = line;
  return {
    spec: {
      key: spec.key,
      name: spec.name,
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      logo: spec.logo,
      limits: spec.limits,
    },
    values: line.values,
    overridden: specFields(spec).filter((field) => line.overrides[field] !== undefined),
  };
}

export type LabelSaveResult = {
  /** Fields over the limit, by product: the label can't be confirmed yet. */
  problems: Map<number, LabelProblem[]>;
};

/**
 * Saves what the user typed for each product's label. Only the differences
 * from the profile are kept as overrides (a field set back to the default is
 * no override), so the rest keeps following the profile. Text over a limit
 * is saved too (so nothing typed is lost) and reported in `problems`.
 * `typed` is keyed by product id; products not in the cart are ignored.
 */
export async function saveLabelDetails(
  userId: string,
  profile: LabelProfile,
  typed: Map<number, LabelValues>,
): Promise<LabelSaveResult> {
  const problems = new Map<number, LabelProblem[]>();
  await db.$transaction(async (tx) => {
    const lines = await readLabelLines(userId, profile, tx);
    for (const line of lines) {
      const input = typed.get(line.productId);
      if (!input) {
        if (line.problems.length > 0) problems.set(line.productId, line.problems);
        continue;
      }
      const cleaned: LabelValues = {};
      for (const field of specFields(line.spec)) {
        const value = input[field];
        if (typeof value === "string") cleaned[field] = tidyLabelText(value).slice(0, MAX_LABEL_LIMIT);
      }
      const overrides = overridesFor(cleaned, line.defaults, line.spec);
      await tx.brandCartItem.updateMany({
        where: { userId, productId: line.productId },
        data: { labelOverrides: Object.keys(overrides).length > 0 ? overrides : Prisma.DbNull },
      });
      const found = labelProblems(effectiveLabelValues(line.defaults, overrides, line.spec), line.spec);
      if (found.length > 0) problems.set(line.productId, found);
    }
  });
  return { problems };
}

const snapshotSchema = z.object({
  spec: z.object({
    key: z.string(),
    name: z.string(),
    widthMm: z.number(),
    heightMm: z.number(),
    logo: z.object({
      widthMm: z.number(),
      heightMm: z.number(),
      placement: z.enum(logoPlacements),
    }),
    limits: limitsSchema,
  }),
  values: overridesSchema,
  overridden: z.array(z.enum(labelFields)),
});

/** A saved order line's label, or null for an order made before label details existed. */
export function parseLabelSnapshot(json: unknown): LabelSnapshot | null {
  const parsed = snapshotSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
