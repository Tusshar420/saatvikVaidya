import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { InventoryStats } from "@/components/admin/inventory-stats";
import { InventoryTabs } from "@/components/admin/inventory-tabs";
import { MovementsTable } from "@/components/admin/inventory-movements";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { inventory as copy } from "@/content/inventory";
import { formatNumber } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory";
import { readB2bOverview } from "@/server/admin/inventory";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.b2b.metaTitle };

const text = copy.b2b;

export default async function B2bInventoryPage() {
  await requireAdmin("inventory");
  const { components, canMake, movements } = await readB2bOverview();
  const low = components.filter((component) => component.low).length;
  const noRecipe = canMake.filter((product) => product.lineCount === 0).length;

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          <Link href="/admin/inventory/b2b/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.components.add}
          </Link>
        }
      />
      <InventoryTabs active="b2b" />
      <p className="mt-4 max-w-3xl text-sm text-muted">{text.intro}</p>
      <InventoryStats
        label={text.metaTitle}
        stats={[
          { label: text.components.title, value: formatNumber(components.length) },
          { label: text.components.low, value: formatNumber(low), warn: low > 0 },
          { label: text.canMake.title, value: formatNumber(canMake.length - noRecipe) },
          { label: text.canMake.none, value: formatNumber(noRecipe), warn: noRecipe > 0 },
        ]}
      />

      <h2 className="mt-8 text-h3 text-ink">{text.components.title}</h2>
      <p className="mt-1 text-small text-muted">{text.components.count(components.length)}</p>
      <DataTable caption={text.components.title} className="mt-3">
        <THead>
          <Th>{text.components.columns.name}</Th>
          <Th>{text.components.columns.type}</Th>
          <Th>{text.components.columns.onHand}</Th>
          <Th>{text.components.columns.reserved}</Th>
          <Th>{text.components.columns.available}</Th>
          <Th>{text.components.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.components.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {components.length === 0 && <EmptyRow colSpan={7}>{text.components.empty}</EmptyRow>}
          {components.map((component) => (
            <Tr key={component.id}>
              <Td>
                <span className="font-bold text-ink">{component.name}</span>
                <span className="block text-small text-muted">{text.components.usedBy(component.usedBy)}</span>
              </Td>
              <Td label={text.components.columns.type}>
                {copy.kinds[component.kind]}
                {component.componentType && component.componentType !== "base" && (
                  <span className="block text-small text-muted">{copy.componentTypes[component.componentType] ?? component.componentType}</span>
                )}
              </Td>
              <Td label={text.components.columns.onHand}>{formatQuantity(component.onHand, component.unit)}</Td>
              <Td label={text.components.columns.reserved}>{formatQuantity(component.reserved, component.unit)}</Td>
              <Td label={text.components.columns.available} className="font-bold text-ink">
                {formatQuantity(component.available, component.unit)}
              </Td>
              <Td label={text.components.columns.status}>
                <span className="flex flex-wrap gap-1.5">
                  {!component.active && <Badge variant="soon">{text.components.inactive}</Badge>}
                  {component.madeToOrder && <Badge variant="blue">{text.components.madeToOrder}</Badge>}
                  {component.low && <Badge variant="orange">{text.components.low}</Badge>}
                  {component.available < 0 && <Badge variant="live">{text.components.short}</Badge>}
                  {component.active && !component.low && !component.madeToOrder && component.available >= 0 && (
                    <Badge variant="teal">{text.components.ok}</Badge>
                  )}
                </span>
              </Td>
              <Td>
                <div className="max-md:mt-2 max-md:*:flex-1 md:flex md:justify-end">
                  <Link
                    href={`/admin/inventory/b2b/${component.id}`}
                    aria-label={text.components.manageLabel(component.name)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    {text.components.manage}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>

      <h2 id="can-make" className="mt-10 text-h3 text-ink">
        {text.canMake.title}
      </h2>
      <p className="mt-1 text-small text-muted">{text.canMake.help}</p>
      <DataTable caption={text.canMake.title} className="mt-3">
        <THead>
          <Th>{text.canMake.columns.product}</Th>
          <Th>{text.canMake.columns.recipe}</Th>
          <Th>{text.canMake.columns.canMake}</Th>
          <Th>{text.canMake.columns.limitedBy}</Th>
          <Th>
            <span className="sr-only">{text.canMake.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {canMake.length === 0 && <EmptyRow colSpan={5}>{text.canMake.empty}</EmptyRow>}
          {canMake.map((product) => (
            <Tr key={product.id}>
              <Td>
                <span className="font-bold text-ink">{product.name}</span>
                <span className="block text-small text-muted">{product.packSize}</span>
              </Td>
              <Td label={text.canMake.columns.recipe}>{product.lineCount === 0 ? text.canMake.none : text.canMake.lines(product.lineCount)}</Td>
              <Td label={text.canMake.columns.canMake} className="font-bold text-ink">
                {product.makeable === null ? text.canMake.noLimit : text.canMake.units(product.makeable, product.unitLabel)}
              </Td>
              <Td label={text.canMake.columns.limitedBy}>{product.limitedBy ?? "–"}</Td>
              <Td>
                <div className="max-md:mt-2 max-md:*:flex-1 md:flex md:justify-end">
                  <Link
                    href={`/admin/inventory/b2b/recipes/${product.id}`}
                    aria-label={text.canMake.editLabel(product.name)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    {text.canMake.edit}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>

      <h2 className="mt-10 text-h3 text-ink">{text.recent}</h2>
      <MovementsTable rows={movements} caption={text.recent} showItem />
    </>
  );
}
