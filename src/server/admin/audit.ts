import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

// The admin audit trail (AdminLog). Every admin change writes one row per
// changed record, inside the same transaction as the change. Values are
// plain JSON; passwords, hashes and tokens are never passed in.

export type AdminAction =
  | "user.create"
  | "user.update"
  | "user.delete"
  | "user.approve"
  | "user.reject"
  | "reel.create"
  | "reel.update"
  | "reel.delete"
  | "brand.create"
  | "brand.update"
  | "brand.delete"
  | "course.create"
  | "course.update"
  | "course.delete"
  | "course.review"
  | "quiz.create"
  | "quiz.update"
  | "quiz.delete"
  | "product.create"
  | "product.update"
  | "product.brand_import"
  | "product.image.add"
  | "product.image.update"
  | "product.image.delete"
  | "order.cancel"
  | "order.mark_paid"
  | "shipment.create"
  | "shipment.update"
  | "brand.proof.upload"
  | "brand.stage"
  | "export.orders"
  | "export.users"
  | "coins.adjust"
  | "coins.rules.update"
  | "ebook.create"
  | "ebook.update"
  | "ebook.file.upload"
  | "ebooks.downloads.update"
  | "setting.update"
  | "home.create"
  | "home.update"
  | "home.delete"
  | "home.sections.update"
  | "admin.invite"
  | "admin.invite.revoke"
  | "admin.invite.accept"
  | "admin.role.update"
  | "admin.remove"
  | "admin.2fa.enable"
  | "admin.2fa.disable"
  | "admin.2fa.reset"
  | "admin.backup-codes.regenerate"
  | "error.status"
  | "report.update"
  | "report.link"
  | "report.unlink"
  | "inventory.item.create"
  | "inventory.item.update"
  | "inventory.recipe.update";

export type AdminResource =
  | "User"
  | "Reel"
  | "Brand"
  | "CourseTeaser"
  | "Quiz"
  | "Product"
  | "Order"
  | "Export"
  | "Setting"
  | "Ebook"
  | "HeroSlide"
  | "StatItem"
  | "Offer"
  | "QuickAction"
  | "Category"
  | "Feedback"
  | "WhyStep"
  | "HomeSection"
  | "Admin"
  | "AdminInvite"
  | "ErrorGroup"
  | "BugReport"
  | "StockItem";

/** `{ field: { from, to } }` for the fields that changed. */
export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

type JsonValue = string | number | boolean | null;

function toJson(value: unknown): JsonValue {
  if (value instanceof Date) return value.toISOString();
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return value === undefined ? null : String(value);
}

/** The fields in `after` whose value differs from `before`. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChanges {
  const changes: FieldChanges = {};
  for (const [field, to] of Object.entries(after)) {
    const from = before[field];
    if (toJson(from) !== toJson(to)) {
      changes[field] = { from: toJson(from), to: toJson(to) };
    }
  }
  return changes;
}

/** Every field as a change from nothing, for a created record. */
export function createdFields(values: Record<string, unknown>): FieldChanges {
  return diffFields({}, values);
}

export type AdminLogEntry = {
  actorId: string;
  action: AdminAction;
  resource: AdminResource;
  resourceId: string | number;
  changes?: FieldChanges;
  note?: string | null;
};

export async function logAdminAction(
  tx: Prisma.TransactionClient,
  entry: AdminLogEntry,
): Promise<void> {
  const changes: Record<string, unknown> = { ...entry.changes };
  if (entry.note) changes.note = entry.note;
  await tx.adminLog.create({
    data: {
      userId: entry.actorId,
      action: entry.action,
      resource: entry.resource,
      resourceId: String(entry.resourceId),
      changes: Object.keys(changes).length
        ? (changes as Prisma.InputJsonObject)
        : undefined,
    },
  });
}

export type ActivityItem = {
  id: number;
  action: string;
  resource: string;
  resourceId: string | null;
  note: string | null;
  changedFields: string[];
  actorName: string | null;
  createdAt: Date;
};

/** Newest admin changes, optionally for one record. */
export async function readActivity(
  options: { resource?: AdminResource; resourceId?: string; take?: number } = {},
): Promise<ActivityItem[]> {
  const rows = await db.adminLog.findMany({
    where: {
      resource: options.resource,
      resourceId: options.resourceId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.take ?? 10,
    include: { user: { select: { name: true } } },
  });
  return rows.map((row) => {
    const changes =
      row.changes && typeof row.changes === "object" && !Array.isArray(row.changes)
        ? (row.changes as Record<string, unknown>)
        : {};
    const { note, ...fields } = changes;
    return {
      id: row.id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      note: typeof note === "string" ? note : null,
      changedFields: Object.keys(fields),
      actorName: row.user?.name ?? null,
      createdAt: row.createdAt,
    };
  });
}
