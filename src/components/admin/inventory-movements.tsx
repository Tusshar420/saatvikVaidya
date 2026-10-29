import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { inventory as copy } from "@/content/inventory";
import { formatDateTime } from "@/lib/format";
import { formatQuantity, type StockUnitKey } from "@/lib/inventory";
import type { MovementRow } from "@/server/admin/inventory";

const text = copy.movements;

/** A stock movement history table. `showItem` adds the item column (lists across items). */
export function MovementsTable({ rows, caption, showItem = false }: { rows: MovementRow[]; caption: string; showItem?: boolean }) {
  const columns = showItem ? 7 : 6;
  return (
    <DataTable caption={caption} className="mt-3">
      <THead>
        <Th>{text.columns.when}</Th>
        {showItem && <Th>{text.columns.item}</Th>}
        <Th>{text.columns.type}</Th>
        <Th>{text.columns.batch}</Th>
        <Th>{text.columns.change}</Th>
        <Th>{text.columns.after}</Th>
        <Th>{text.columns.by}</Th>
      </THead>
      <TBody>
        {rows.length === 0 && <EmptyRow colSpan={columns}>{text.empty}</EmptyRow>}
        {rows.map((row) => {
          const unit = row.item.unit as StockUnitKey;
          const change = row.onHandDelta !== 0 ? row.onHandDelta : row.reservedDelta;
          const sign = change > 0 ? "+" : change < 0 ? "−" : "";
          return (
            <Tr key={row.id}>
              <Td label={text.columns.when} className="whitespace-nowrap">
                {formatDateTime(row.createdAt)}
              </Td>
              {showItem && <Td label={text.columns.item}>{row.item.name}</Td>}
              <Td label={text.columns.type}>
                <span className="font-bold text-ink">{copy.movementTypes[row.type] ?? row.type}</span>
                {(row.reason || row.refType) && (
                  <span className="block text-small text-muted">
                    {[row.refType ? copy.refTypes[row.refType] : null, row.reason].filter(Boolean).join(": ")}
                  </span>
                )}
              </Td>
              <Td label={text.columns.batch}>{row.batch?.batchNo ?? "–"}</Td>
              <Td label={text.columns.change} className="whitespace-nowrap">
                {sign}
                {formatQuantity(Math.abs(change), unit)}
                {row.onHandDelta === 0 && row.reservedDelta !== 0 && <span className="text-muted"> (held)</span>}
              </Td>
              <Td label={text.columns.after} className="whitespace-nowrap">
                {formatQuantity(row.onHandAfter, unit)}
              </Td>
              <Td label={text.columns.by}>{row.user?.name ?? text.system}</Td>
            </Tr>
          );
        })}
      </TBody>
    </DataTable>
  );
}
