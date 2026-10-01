import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { admin as copy } from "@/content/admin";
import { coinReasonText } from "@/lib/coin-reason";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { RecentCoinEntry } from "@/server/coins/ledger";

const text = copy.coins;

/** Recent ledger rows. `showUser` adds the user's name (the all-users list). */
export function CoinActivity({
  entries,
  caption,
  showUser = true,
}: {
  entries: RecentCoinEntry[];
  caption: string;
  showUser?: boolean;
}) {
  return (
    <DataTable caption={caption} className="mt-3">
      <THead>
        <Th>{text.columns.when}</Th>
        {showUser && <Th>{text.columns.user}</Th>}
        <Th>{text.columns.change}</Th>
        <Th>{text.columns.reason}</Th>
      </THead>
      <TBody>
        {entries.length === 0 && <EmptyRow colSpan={showUser ? 4 : 3}>{text.recentEmpty}</EmptyRow>}
        {entries.map((entry) => (
          <Tr key={entry.id}>
            <Td label={text.columns.when}>{formatDateTime(entry.createdAt)}</Td>
            {showUser && <Td label={text.columns.user}>{entry.userName}</Td>}
            <Td
              label={text.columns.change}
              className={cn("font-bold", entry.amount < 0 ? "text-danger" : "text-green")}
            >
              {entry.amount > 0 ? "+" : "−"}
              {formatNumber(Math.abs(entry.amount))}
            </Td>
            <Td label={text.columns.reason}>{coinReasonText(entry)}</Td>
          </Tr>
        ))}
      </TBody>
    </DataTable>
  );
}
