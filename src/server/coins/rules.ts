import "server-only";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { logAdminAction, diffFields } from "@/server/admin/audit";
import { contentTags } from "@/server/content/cache";
import { getSetting, settingSchemas } from "@/server/content/settings";
import { db } from "@/server/db";

// Editing the "coins.rules" setting from /admin/coins. Writes the value, its
// history row and the admin log together, then refreshes the cached settings.

const whole = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value.trim()) : Number.NaN),
    z.number().int().min(min).max(max),
  );

const checked = z.preprocess((value) => value === "on", z.boolean());

export const coinRulesForm = z.object({
  enabled: checked,
  earnPerThousandRupees: whole(0, 10_000),
  earnAfterDelivery: checked,
  interestsReward: whole(0, 1_000_000),
  detailsReward: whole(0, 1_000_000),
  quizReward: whole(0, 1_000_000),
  coinsPerRupee: whole(1, 1_000),
  maxRedeemPercent: whole(0, 100),
  maxRedeemCoins: whole(0, 100_000_000),
  expiryMonths: whole(0, 240),
}) satisfies z.ZodType<unknown>;

export async function updateCoinRules(
  actorId: string,
  rules: z.infer<typeof coinRulesForm>,
): Promise<void> {
  const value = settingSchemas["coins.rules"].parse(rules);
  const before = await getSetting("coins.rules");
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: "coins.rules" },
      create: { key: "coins.rules", value, updatedBy: actorId },
      update: { value, updatedBy: actorId },
    });
    await tx.settingHistory.create({ data: { settingKey: "coins.rules", value, changedBy: actorId } });
    await logAdminAction(tx, {
      actorId,
      action: "coins.rules.update",
      resource: "Setting",
      resourceId: "coins.rules",
      changes: diffFields(before, value),
    });
  });
  revalidateTag(contentTags.settings, "max");
}
