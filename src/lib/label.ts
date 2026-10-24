// Label rules for Build Your Brand, shared by the /launch page (live
// counters and warnings) and the server (which checks everything again).
// No "server-only" import: client components use it too.
//
// A label spec says what one kind of pack (tube, syrup bottle, jar...) can
// print: its printable area, which fields fit with how many characters, and
// where the logo goes. A brand profile holds the shared defaults. Each
// Launch cart line starts from the profile, fitted to the product's spec,
// and may override any field for that one product.

/** Every field a label can carry, in the order they are shown. */
export const labelFields = [
  "brandName",
  "tagline",
  "description",
  "ingredients",
  "usage",
  "marketedByName",
  "marketedByAddress",
  "contactPhone",
  "licenceNumbers",
] as const;
export type LabelField = (typeof labelFields)[number];

/** Fields that may run over several lines. */
export const multilineLabelFields: readonly LabelField[] = [
  "description",
  "ingredients",
  "usage",
  "marketedByAddress",
  "licenceNumbers",
];

/** Largest character limit a spec may set for one field. */
export const MAX_LABEL_LIMIT = 2000;

export const logoPlacements = ["top-left", "top-center", "top-right", "center", "bottom-center"] as const;
export type LogoPlacement = (typeof logoPlacements)[number];

export const descriptionSources = ["short", "long"] as const;
export type DescriptionSource = (typeof descriptionSources)[number];

/** What one kind of pack can print (a LabelSpec row, as the pages use it). */
export type LabelSpecData = {
  key: string;
  name: string;
  /** Printable area in millimetres. */
  widthMm: number;
  heightMm: number;
  /** Largest logo and where it sits. */
  logo: { widthMm: number; heightMm: number; placement: LogoPlacement };
  /** Which profile description the label starts from. */
  descriptionSource: DescriptionSource;
  /** Characters allowed per field. A field not listed isn't printed on this label. */
  limits: Partial<Record<LabelField, number>>;
};

/** Used for a product that has no spec of its own. */
export const DEFAULT_LABEL_SPEC: LabelSpecData = {
  key: "general",
  name: "General pack",
  widthMm: 80,
  heightMm: 50,
  logo: { widthMm: 25, heightMm: 15, placement: "top-left" },
  descriptionSource: "short",
  limits: {
    brandName: 60,
    tagline: 80,
    description: 160,
    marketedByName: 80,
    marketedByAddress: 160,
    contactPhone: 20,
    licenceNumbers: 80,
  },
};

export type LabelValues = Partial<Record<LabelField, string>>;

/** The brand profile fields a label can start from. */
export type LabelProfile = {
  brandName: string;
  tagline: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  marketedByName: string | null;
  marketedByAddress: string | null;
  contactPhone: string | null;
  licenceNumbers: string | null;
};

/** What the product itself contributes (its own ingredients and dosage text). */
export type LabelProduct = { ingredients: string | null; dosage: string | null };

/** The fields printed on this label, in order. */
export function specFields(spec: Pick<LabelSpecData, "limits">): LabelField[] {
  return labelFields.filter((field) => typeof spec.limits[field] === "number");
}

/** Line breaks as \n, runs of spaces and tabs collapsed, ends trimmed. */
export function tidyLabelText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

/**
 * Text cut to `limit` characters at a word boundary, with an ellipsis, when
 * it is too long; unchanged when it fits.
 */
export function fitLabelText(text: string, limit: number): { text: string; trimmed: boolean } {
  if (text.length <= limit) return { text, trimmed: false };
  if (limit <= 1) return { text: text.slice(0, Math.max(0, limit)), trimmed: true };
  const room = text.slice(0, limit - 1);
  const lastSpace = Math.max(room.lastIndexOf(" "), room.lastIndexOf("\n"));
  // Keep at least half of the room, so one long word isn't cut to nothing.
  const cut = lastSpace >= limit / 2 ? room.slice(0, lastSpace) : room;
  return { text: `${cut.trimEnd().replace(/[,;:.\-–]+$/, "")}…`, trimmed: true };
}

export type LabelDefaults = {
  values: LabelValues;
  /** Fields whose profile text was too long and was shortened to fit. */
  trimmed: LabelField[];
};

/**
 * A line's starting label: the profile's text picked and shortened to fit
 * the spec. The description is the profile's short or long one as the spec
 * says (the other when that one is blank); ingredients and usage come from
 * the product. Fields the spec doesn't print are left out.
 */
export function defaultLabelValues(
  profile: LabelProfile,
  product: LabelProduct,
  spec: LabelSpecData,
): LabelDefaults {
  const description =
    spec.descriptionSource === "short"
      ? profile.shortDescription || profile.longDescription
      : profile.longDescription || profile.shortDescription;
  const source: Record<LabelField, string | null> = {
    brandName: profile.brandName,
    tagline: profile.tagline,
    description,
    ingredients: product.ingredients,
    usage: product.dosage,
    marketedByName: profile.marketedByName,
    marketedByAddress: profile.marketedByAddress,
    contactPhone: profile.contactPhone,
    licenceNumbers: profile.licenceNumbers,
  };
  const values: LabelValues = {};
  const trimmed: LabelField[] = [];
  for (const field of specFields(spec)) {
    const limit = spec.limits[field] ?? 0;
    const fitted = fitLabelText(tidyLabelText(source[field] ?? ""), limit);
    values[field] = fitted.text;
    if (fitted.trimmed) trimmed.push(field);
  }
  return { values, trimmed };
}

/** A line's overrides: only the fields the user changed for this product. */
export type LabelOverrides = LabelValues;

/** The label as it will print: the defaults with the line's overrides on top. */
export function effectiveLabelValues(
  defaults: LabelValues,
  overrides: LabelOverrides,
  spec: LabelSpecData,
): LabelValues {
  const values: LabelValues = {};
  for (const field of specFields(spec)) {
    values[field] = overrides[field] ?? defaults[field] ?? "";
  }
  return values;
}

/**
 * The overrides to keep for what the user typed: only fields on the label
 * whose text differs from the default.
 */
export function overridesFor(
  typed: LabelValues,
  defaults: LabelValues,
  spec: LabelSpecData,
): LabelOverrides {
  const overrides: LabelOverrides = {};
  for (const field of specFields(spec)) {
    const value = tidyLabelText(typed[field] ?? defaults[field] ?? "");
    if (value !== (defaults[field] ?? "")) overrides[field] = value;
  }
  return overrides;
}

export type LabelProblem = { field: LabelField; length: number; limit: number };

/** Fields whose text is longer than the spec allows (length 0: a blank brand name). */
export function labelProblems(values: LabelValues, spec: LabelSpecData): LabelProblem[] {
  const problems: LabelProblem[] = [];
  for (const field of specFields(spec)) {
    const length = (values[field] ?? "").length;
    const limit = spec.limits[field] ?? 0;
    if (length > limit || (field === "brandName" && length === 0)) problems.push({ field, length, limit });
  }
  return problems;
}

/** Characters left (negative when over) for a field. */
export function labelRoom(value: string | undefined, limit: number): number {
  return limit - (value ?? "").length;
}

// ─── Brand profile checks shared with the form ──────────────────────────────

/** Longest value of each brand profile field (matches the database columns). */
export const profileLimits = {
  profileName: 60,
  brandName: 80,
  tagline: 120,
  shortDescription: 160,
  longDescription: 600,
  marketedByName: 120,
  marketedByAddress: 300,
  contactPhone: 20,
  licenceNumbers: 300,
  colour: 7,
} as const;

/** The most brand profiles one account can keep. */
export const MAX_BRAND_PROFILES = 10;

/** A colour as #RRGGBB (what the colour picker sends). */
export function isHexColour(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** The stored copy of a line's label, saved with the order so proofs match what was approved. */
export type LabelSnapshot = {
  spec: Pick<LabelSpecData, "key" | "name" | "widthMm" | "heightMm" | "logo" | "limits">;
  values: LabelValues;
  /** Fields the customer changed for this product. */
  overridden: LabelField[];
};
