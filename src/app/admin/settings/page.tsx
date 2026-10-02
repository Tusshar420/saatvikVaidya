import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForms } from "@/components/admin/settings-forms";
import { adminSettings as copy } from "@/content/admin-site";
import { formatDateTime, paiseToRupeeInput } from "@/lib/format";
import { readSettingHistory, readSettingsForAdmin } from "@/server/admin/settings";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.metaTitle };

export default async function AdminSettingsPage() {
  await requireAdmin("settings", "/admin/settings");
  const [s, history] = await Promise.all([readSettingsForAdmin(), readSettingHistory()]);

  return (
    <>
      <AdminPageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <SettingsForms
        contact={{
          phone: s.phone,
          supportNote: s.supportNote,
          footerTagline: s.tagline,
          popularSearches: s.popular.join("\n"),
        }}
        announcement={{
          enabled: s.announcement.enabled,
          text: s.announcement.text,
          href: s.announcement.href ?? "",
        }}
        shipping={{
          fee: paiseToRupeeInput(s.shipping.feePaise),
          freeFrom: s.shipping.freeFromPaise === null ? "" : paiseToRupeeInput(s.shipping.freeFromPaise),
        }}
        seller={{
          legalName: s.seller.legalName,
          addressLines: s.seller.addressLines.join("\n"),
          city: s.seller.city,
          stateCode: s.seller.stateCode,
          pincode: s.seller.pincode,
          gstin: s.seller.gstin,
        }}
        switches={{
          checkout: s.checkout.enabled,
          coins: s.coins.enabled,
          ebooks: s.ebooks.enabled,
          maintenance: s.maintenance.enabled,
          maintenanceMessage: s.maintenance.message,
        }}
      />
      <section aria-labelledby="settings-history" className="mt-10 max-w-4xl">
        <h2 id="settings-history" className="text-h3 text-ink">
          {copy.historyTitle}
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{copy.historyEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-3">
                <code className="font-bold text-ink">{row.key}</code>
                <span className="text-muted">
                  {formatDateTime(row.changedAt)} ·{" "}
                  {row.by ? copy.historyBy(row.by) : copy.historySeed}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
