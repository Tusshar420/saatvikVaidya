import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { AdjustForm, ReceiveForm, SettingsForm, WriteOffButton } from "@/components/admin/inventory-forms";
import { MovementsTable } from "@/components/admin/inventory-movements";
import { InventoryStats } from "@/components/admin/inventory-stats";
import { InventoryTabs } from "@/components/admin/inventory-tabs";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { inventory as copy } from "@/content/inventory";
import { formatDate, formatPaise } from "@/lib/format";
import { daysToExpiry, expiryState, formatQuantity, isLow } from "@/lib/inventory";
import { readStockItem } from "@/server/admin/inventory";
import { intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.b2c.metaTitle };

const text = copy.item;

export default async function B2cItemPage({ params }: PageProps<"/admin/inventory/b2c/[id]">) {
  await requireAdmin("inventory");
  const id = intId.safeParse((await params).id);
  const found = id.success ? await readStockItem(id.data) : null;
  if (!found || found.item.kind !== "finished") notFound();
  const { item, movements } = found;
  const sellable = item.batches
    .filter((batch) => expiryState(batch.expiryDate) !== "expired")
    .reduce((sum, batch) => sum + batch.qtyOnHand - batch.qtyReserved, 0);
  const brand = item.product?.brand;
  const withStock = item.batches.filter((batch) => batch.qtyOnHand > 0);

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={item.name}
        description={brand ? `${brand.name} · ${brand.isPartner ? text.partner : text.ownBrand}` : undefined}
        action={
          <Link href="/admin/inventory/b2c" className={buttonClasses({ variant: "secondary" })}>
            {text.back}
          </Link>
        }
      />
      <InventoryTabs active="b2c" />
      <InventoryStats
        label={item.name}
        stats={[
          { label: text.summary.onHand, value: formatQuantity(item.onHand, item.unit) },
          { label: text.summary.reserved, value: formatQuantity(item.reserved, item.unit) },
          { label: text.summary.available, value: formatQuantity(sellable, item.unit), warn: isLow(sellable, item.lowThreshold) || sellable === 0 },
          {
            label: text.summary.threshold,
            value: item.lowThreshold > 0 ? formatQuantity(item.lowThreshold, item.unit) : text.thresholdNone,
          },
        ]}
      />
      {item.purchaseCostPaise !== null && (
        <p className="mt-3 text-sm text-muted">
          {text.summary.cost}: {formatPaise(item.purchaseCostPaise)}
        </p>
      )}

      <h2 className="mt-8 text-h3 text-ink">{text.batches.title}</h2>
      <DataTable caption={text.batches.title} className="mt-3">
        <THead>
          <Th>{text.batches.columns.batch}</Th>
          <Th>{text.batches.columns.qty}</Th>
          <Th>{text.batches.columns.held}</Th>
          <Th>{text.batches.columns.mfg}</Th>
          <Th>{text.batches.columns.expiry}</Th>
          <Th>{text.batches.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.batches.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {item.batches.length === 0 && <EmptyRow colSpan={7}>{text.batches.empty}</EmptyRow>}
          {item.batches.map((batch) => {
            const state = expiryState(batch.expiryDate);
            const days = daysToExpiry(batch.expiryDate);
            return (
              <Tr key={batch.id}>
                <Td label={text.batches.columns.batch} className="font-bold text-ink">
                  {batch.batchNo}
                </Td>
                <Td label={text.batches.columns.qty}>{formatQuantity(batch.qtyOnHand, item.unit)}</Td>
                <Td label={text.batches.columns.held}>{formatQuantity(batch.qtyReserved, item.unit)}</Td>
                <Td label={text.batches.columns.mfg}>{batch.mfgDate ? formatDate(batch.mfgDate) : "–"}</Td>
                <Td label={text.batches.columns.expiry}>{batch.expiryDate ? formatDate(batch.expiryDate) : "–"}</Td>
                <Td label={text.batches.columns.status}>
                  {state === "expired" ? (
                    <Badge variant="live">{text.batches.state.expired}</Badge>
                  ) : state === "soon" ? (
                    <Badge variant="gold">{text.batches.state.soon(days ?? 0)}</Badge>
                  ) : state === "ok" ? (
                    <Badge variant="brand">{text.batches.state.ok}</Badge>
                  ) : (
                    <span className="text-muted">{text.batches.state.none}</span>
                  )}
                </Td>
                <Td>
                  {state === "expired" && batch.qtyOnHand - batch.qtyReserved > 0 && (
                    <WriteOffButton batchId={batch.id} label={text.batches.writeOffLabel(batch.batchNo)} />
                  )}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </DataTable>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <ReceiveForm itemId={item.id} unit={item.unit} finished />
        <AdjustForm
          itemId={item.id}
          unit={item.unit}
          batches={withStock.map((batch) => ({
            id: batch.id,
            label: `${batch.batchNo} (${formatQuantity(batch.qtyOnHand, item.unit)})`,
          }))}
        />
      </div>
      <div className="mt-5 max-w-2xl">
        <SettingsForm
          item={{
            id: item.id,
            unit: item.unit,
            finished: true,
            baseKind: false,
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

      <h2 className="mt-10 text-h3 text-ink">{text.history}</h2>
      <MovementsTable rows={movements} caption={text.history} />
    </>
  );
}
