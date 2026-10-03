import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { LabelField } from "@/lib/label";

// Label specs (Launch Your Brand): what each kind of pack can print. The
// sizes are working figures for the first packs; the client confirms the
// real printable areas with the printer.

type SpecSeed = {
  key: string;
  name: string;
  sortOrder: number;
  widthMm: number;
  heightMm: number;
  logoWidthMm: number;
  logoHeightMm: number;
  logoPlacement: "top_left" | "top_center" | "top_right" | "center" | "bottom_center";
  descriptionSource: "short" | "long";
  limits: Partial<Record<LabelField, number>>;
};

export const labelSpecSeed: readonly SpecSeed[] = [
  {
    // A small wrap-around label: short description, no ingredients or usage.
    key: "tube",
    name: "Tube",
    sortOrder: 10,
    widthMm: 90,
    heightMm: 40,
    logoWidthMm: 20,
    logoHeightMm: 12,
    logoPlacement: "top_left",
    descriptionSource: "short",
    limits: {
      brandName: 40,
      tagline: 50,
      description: 90,
      marketedByName: 50,
      contactPhone: 20,
      licenceNumbers: 50,
    },
  },
  {
    key: "bottle",
    name: "Syrup or tablet bottle",
    sortOrder: 20,
    widthMm: 100,
    heightMm: 60,
    logoWidthMm: 30,
    logoHeightMm: 20,
    logoPlacement: "top_center",
    descriptionSource: "long",
    limits: {
      brandName: 60,
      tagline: 80,
      description: 250,
      ingredients: 200,
      usage: 150,
      marketedByName: 80,
      marketedByAddress: 160,
      contactPhone: 20,
      licenceNumbers: 120,
    },
  },
  {
    key: "jar",
    name: "Jar",
    sortOrder: 30,
    widthMm: 120,
    heightMm: 70,
    logoWidthMm: 35,
    logoHeightMm: 25,
    logoPlacement: "top_center",
    descriptionSource: "long",
    limits: {
      brandName: 60,
      tagline: 80,
      description: 300,
      ingredients: 250,
      usage: 200,
      marketedByName: 80,
      marketedByAddress: 200,
      contactPhone: 20,
      licenceNumbers: 150,
    },
  },
  {
    key: "pouch",
    name: "Pouch or pack",
    sortOrder: 40,
    widthMm: 110,
    heightMm: 150,
    logoWidthMm: 40,
    logoHeightMm: 25,
    logoPlacement: "top_center",
    descriptionSource: "long",
    limits: {
      brandName: 60,
      tagline: 100,
      description: 400,
      ingredients: 300,
      usage: 250,
      marketedByName: 100,
      marketedByAddress: 250,
      contactPhone: 20,
      licenceNumbers: 200,
    },
  },
];

/** Which spec the client's product forms start with (the admin can change a product's). */
export const formLabelSpec: Record<string, string> = {
  "asava-arishta": "bottle",
  kwath: "bottle",
  guggulu: "bottle",
  "vati-gutika": "bottle",
  "herbal-tablets": "bottle",
  "taila-ghrita": "bottle",
  avaleha: "jar",
  churna: "pouch",
  bhasma: "pouch",
  wellness: "pouch",
  kupipakwa: "pouch",
};

type Client = PrismaClient | Prisma.TransactionClient;

/** Creates the specs whose key is missing; edited specs are left alone. */
export async function seedLabelSpecs(db: Client): Promise<void> {
  for (const spec of labelSpecSeed) {
    await db.labelSpec.upsert({ where: { key: spec.key }, create: spec, update: {} });
  }
}

/**
 * Gives every product that has no label spec the one that suits its form
 * (a product of a form not listed keeps the general spec).
 */
export async function assignLabelSpecs(db: Client): Promise<number> {
  const specs = await db.labelSpec.findMany({ select: { id: true, key: true } });
  const specId = new Map(specs.map((spec) => [spec.key, spec.id]));
  let assigned = 0;
  for (const [formKey, specKey] of Object.entries(formLabelSpec)) {
    const id = specId.get(specKey);
    if (id === undefined) continue;
    const result = await db.product.updateMany({
      where: { labelSpecId: null, form: { is: { key: formKey } } },
      data: { labelSpecId: id },
    });
    assigned += result.count;
  }
  return assigned;
}
