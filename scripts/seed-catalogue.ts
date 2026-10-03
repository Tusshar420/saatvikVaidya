// `pnpm db:seed:catalogue`: loads the client's real product list
// (src/server/seed/catalogue-list.ts) into the catalogue, so it can be managed
// in /admin/catalogue. Safe to repeat: a product is only created when its slug
// is missing, so admin edits are kept. The 12 sample products are left alone.
import { existsSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { SAMPLE_GST_RATE, SAMPLE_HSN_CODE } from "../src/server/seed/catalogue";
import { buildProducts } from "../src/server/seed/catalogue-load";
import { extraAreas, extraForms } from "../src/server/seed/catalogue-list";
import { assignLabelSpecs, seedLabelSpecs } from "../src/server/seed/label-specs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });

async function main(): Promise<void> {
  for (const form of extraForms) {
    await db.category.upsert({
      where: { key: form.key },
      create: { ...form, kind: "FORM" },
      update: {},
    });
  }
  for (const area of extraAreas) {
    await db.category.upsert({
      where: { key: area.key },
      create: {
        key: area.key,
        name: area.name,
        glyph: area.glyph,
        sortOrder: area.sortOrder,
        kind: "PRACTICE_AREA",
      },
      update: {},
    });
  }

  const brand = await db.brand.findUnique({ where: { key: "sabka-vaidya" } });
  const categories = await db.category.findMany({
    select: { id: true, key: true },
  });
  const categoryId = new Map(categories.map((c) => [c.key, c.id]));

  let created = 0;
  let existing = 0;
  for (const product of buildProducts()) {
    const { formKey, areaKeys, ...fields } = product;
    if (await db.product.findUnique({ where: { slug: product.slug } })) {
      existing += 1;
      continue;
    }
    await db.product.create({
      data: {
        ...fields,
        isSample: false,
        gstRate: SAMPLE_GST_RATE,
        hsnCode: SAMPLE_HSN_CODE,
        brandId: brand?.id ?? null,
        formId: categoryId.get(formKey)!,
        practiceAreas: {
          connect: areaKeys.flatMap((key) => {
            const id = categoryId.get(key);
            return id === undefined ? [] : [{ id }];
          }),
        },
      },
    });
    created += 1;
  }
  console.info(`Catalogue: ${created} products created, ${existing} already there.`);
  await seedLabelSpecs(db);
  console.info(`Label specs: ${await assignLabelSpecs(db)} products given a spec by their form.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
