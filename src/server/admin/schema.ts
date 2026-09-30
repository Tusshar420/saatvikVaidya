import "server-only";
import { db } from "@/server/db";

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

export async function getTableNames(): Promise<string[]> {
  const result = await db.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `;
  return result.map((r) => r.TABLE_NAME);
}

export async function getTableInfo(tableName: string): Promise<TableInfo> {
  // Get column info
  const columns = await db.$queryRawUnsafe<ColumnInfo[]>(`
    SELECT
      COLUMN_NAME as name,
      COLUMN_TYPE as type,
      IS_NULLABLE = 'YES' as nullable,
      COLUMN_KEY = 'PRI' as isPrimary,
      COLUMN_DEFAULT as \`default\`
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `, tableName);

  // Get row count
  const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM \`${tableName}\``,
  );
  const rowCount = Number(countResult[0]?.count ?? 0);

  return {
    name: tableName,
    columns,
    rowCount,
  };
}

export async function getTableData(
  tableName: string,
  limit: number = 50,
  offset: number = 0,
) {
  const data = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
  return data;
}
