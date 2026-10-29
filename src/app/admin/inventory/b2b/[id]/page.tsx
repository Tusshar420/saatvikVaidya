import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdjustForm, ReceiveForm, SettingsForm } from "@/components/admin/inventory-forms";
import { MovementsTable } from "@/components/admin/inventory-movements";
import { InventoryStats } from "@/components/admin/inventory-stats";
import { InventoryTabs } from "@/components/admin/inventory-tabs";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { inventory as copy } from "@/content/inventory";
import { formatQuantity, isLow } from "@/lib/inventory";
import { readStockItem } from "@/server/admin/inventory";
import { intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.b2b.metaTitle };

const text = copy.component;

export default async function ComponentPage({ params, searchParams }: PageProps<"/admin/inventory/b2b/[id]">) {
  await requireAdmin("inventory");
  const id = intId.safeParse((await params).id);
  const found = id.success ? await readStockItem(id.data) : null;
  if (!found || found.item.kind === "finished") notFound();
  const { item, movements } = found;
  const available = item.onHand - item.reserved;

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={item.name}
        description={`${copy.kinds[item.kind]}${item.componentType && item.componentType !== "base" ? ` · ${copy.componentTypes[item.componentType] ?? item.componentType}` : ""}`}
        action={
          <Link href="/admin/inventory/b2b" className={buttonClasses({ variant: "secondary" })}>
            {text.back}
          </Link>
        }
      />
      <InventoryTabs active="b2b" />
      <Notice notice={parseNotice((await searchParams).notice)} />
      <InventoryStats
        label={item.name}
        stats={[
          { label: text.summary.onHand, value: formatQuantity(item.onHand, item.unit) },
          { label: text.summary.reserved, value: formatQuantity(item.reserved, item.unit) },
          {
            label: text.summary.available,
            value: formatQuantity(available, item.unit),
            warn: available < 0 || (!item.madeToOrder && isLow(available, item.lowThreshold)),
          },
        ]}
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <ReceiveForm itemId={item.id} unit={item.unit} finished={false} text={{ ...copy.item.receive, ...text.receive }} />
        <AdjustForm itemId={item.id} unit={item.unit} text={text.adjust} />
      </div>
      <div className="mt-5 max-w-2xl">
        <SettingsForm
          item={{
            id: item.id,
            unit: item.unit,
            finished: false,
            baseKind: item.kind === "base",
            name: item.name,
            sku: item.sku,
            componentType: item.componentType,
            notes: item.notes,
            lowThreshold: item.lowThreshold,
            purchaseCostPaise: item.purchaseCostPaise,
            madeToOrder: item.madeToOrder,
            active: item.active,
          }}
        />
      </div>

      <h2 className="mt-10 text-h3 text-ink">{text.recipesTitle}</h2>
      {item.recipeLines.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{text.noRecipes}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
          {item.recipeLines.map((line) => (
            <li key={line.product.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold text-ink">{line.product.name}</p>
                <p className="text-small text-muted">{text.perUnit(line.quantity, item.unit)}</p>
              </div>
              <Link
                href={`/admin/inventory/b2b/recipes/${line.product.id}`}
                aria-label={copy.b2b.canMake.editLabel(line.product.name)}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                {copy.b2b.canMake.edit}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-h3 text-ink">{copy.item.history}</h2>
      <MovementsTable rows={movements} caption={copy.item.history} />
    </>
  );
}
