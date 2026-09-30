import { afterAll, expect, it } from "vitest";
import { db } from "@/server/db";

afterAll(async () => {
  await db.$disconnect();
});

it("connects to the test database, not the dev one", async () => {
  const rows = await db.$queryRaw<
    { name: string }[]
  >`SELECT DATABASE() AS name`;
  expect(rows[0]?.name).toBe("saatvik_vaidya_test");
});
