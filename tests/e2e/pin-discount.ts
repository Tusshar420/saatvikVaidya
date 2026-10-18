import { e2eDb } from "./auth-helpers";

// Playwright's globalSetup: the site-wide discount (setting "pricing.discount")
// is 20% by default, but most specs check plain prices. This sets it to 0 for
// the run and puts back what was there afterwards (returned function = teardown).
// The discount spec (site-settings.exclusive.spec.ts) turns it on itself.
export default async function pinDiscount() {
  const db = e2eDb();
  const before = await db.setting.findUnique({ where: { key: "pricing.discount" } });
  const off = { percent: 0 };
  await db.setting.upsert({
    where: { key: "pricing.discount" },
    create: { key: "pricing.discount", value: off },
    update: { value: off },
  });
  await db.$disconnect();
  return async () => {
    const after = e2eDb();
    if (before) {
      await after.setting.update({
        where: { key: "pricing.discount" },
        data: { value: before.value as object },
      });
    } else {
      await after.setting.deleteMany({ where: { key: "pricing.discount" } });
    }
    await after.$disconnect();
  };
}
