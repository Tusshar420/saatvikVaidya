import "server-only";
import { admin as copy } from "@/content/admin";
import { db } from "@/server/db";

// The read-only database browser (/admin/database). Table names are only
// ever used after checking them against information_schema, so the
// back-quoted names in the raw queries can't be injected.

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
  default: string | null;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

/**
 * Columns never shown, even to admins: password hashes, session and OAuth
 * tokens, OTP codes, and password-reset tokens (which Better Auth keeps in
 * Verification.identifier as "reset-password:<token>").
 */
const hiddenColumns: Record<string, readonly string[]> = {
  Account: ["password", "accessToken", "refreshToken", "idToken"],
  Session: ["token"],
  Verification: ["identifier", "value"],
};

export function isHiddenColumn(table: string, column: string): boolean {
  return hiddenColumns[table]?.includes(column) ?? false;
}

export async function getTableNames(): Promise<string[]> {
  const result = await db.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `;
  return result.map((r) => r.TABLE_NAME);
}

/** True for a table that exists in this database. */
export async function isTableName(name: string): Promise<boolean> {
  return (await getTableNames()).includes(name);
}

export async function getRowCount(tableName: string): Promise<number> {
  const result = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM \`${tableName}\``,
  );
  return Number(result[0]?.count ?? 0);
}

export async function getTableInfo(tableName: string): Promise<TableInfo> {
  const columns = await db.$queryRawUnsafe<ColumnInfo[]>(
    `
    SELECT
      COLUMN_NAME as name,
      COLUMN_TYPE as type,
      IS_NULLABLE = 'YES' as nullable,
      COLUMN_KEY = 'PRI' as isPrimary,
      COLUMN_DEFAULT as \`default\`
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `,
    tableName,
  );
  return { name: tableName, columns, rowCount: await getRowCount(tableName) };
}

/** A page of rows, with secret columns replaced by "[hidden]". */
export async function getTableData(
  tableName: string,
  limit: number = 50,
  offset: number = 0,
): Promise<Record<string, unknown>[]> {
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
  const hidden = hiddenColumns[tableName];
  return rows.map((row) => {
    const safe: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(row)) {
      safe[column] = hidden?.includes(column)
        ? copy.database.hidden
        : // BigInt can't be sent as JSON.
          typeof value === "bigint"
          ? value.toString()
          : value;
    }
    return safe;
  });
}
