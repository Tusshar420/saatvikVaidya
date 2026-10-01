import type { Metadata } from "next";
import { CoinActivity } from "@/components/admin/coin-activity";
import { CoinRulesForm } from "@/components/admin/coin-rules-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { formatINR, formatNumber } from "@/lib/format";
import { coinsEarned, coinValuePaise } from "@/lib/coins";
import { requireAdmin } from "@/server/auth/session";
import { readRecentCoinActivity } from "@/server/coins/ledger";
import { getSetting } from "@/server/content/settings";

export const metadata: Metadata = { title: copy.coins.metaTitle };

const text = copy.coins;

/** Super Coins: the earning and redeeming rules, and the latest ledger rows. */
export default async function AdminCoinsPage() {
  await requireAdmin();
  const [rules, recent] = await Promise.all([getSetting("coins.rules"), readRecentCoinActivity(15)]);
  const orderPaise = 1_000_000;
  return (
    <>
      <AdminPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />
      <div className="mt-6 flex max-w-4xl flex-col gap-6">
        <CoinRulesForm rules={rules} />
        <section aria-labelledby="coin-example" className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 id="coin-example" className="text-h3 text-ink">
            {text.exampleTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {text.example(
              formatNumber(coinsEarned(orderPaise, rules)),
              formatINR(orderPaise / 100),
              formatINR(coinValuePaise(1_000, rules) / 100),
              formatNumber(1_000),
            )}
          </p>
        </section>
      </div>
      <section aria-labelledby="coin-recent" className="mt-8">
        <h2 id="coin-recent" className="text-h3 text-ink">
          {text.recentTitle}
        </h2>
        <CoinActivity entries={recent} caption={text.recentTitle} />
      </section>
    </>
  );
}
