import { Badge } from "@/components/ui/badge";
import { admin as copy } from "@/content/admin";
import { formatDateTime } from "@/lib/format";
import type { ActivityItem } from "@/server/admin/audit";

/** Newest admin changes, one line each. */
export function ActivityList({
  items,
  empty,
}: {
  items: ActivityItem[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-muted">{empty}</p>;
  }
  return (
    <ol className="mt-4 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-0.5 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={item.action.endsWith("reject") ? "orange" : "teal"}>
              {copy.activity.actions[item.action] ?? item.action}
            </Badge>
            <span className="font-semibold text-ink">
              {item.resource} #{item.resourceId}
            </span>
          </span>
          <span className="text-small text-muted">
            {formatDateTime(item.createdAt)} ·{" "}
            {copy.activity.by(item.actorName ?? copy.activity.deletedAdmin)}
          </span>
          {item.note && (
            <span className="text-small text-ink">
              {copy.userDetail.note(item.note)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
