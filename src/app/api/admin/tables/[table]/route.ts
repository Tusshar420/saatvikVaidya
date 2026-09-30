import { requireAdmin } from "@/server/auth/session";
import { getTableData, getTableNames } from "@/server/admin/schema";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> },
) {
  try {
    await requireAdmin();

    const { table: tableName } = await params;
    const { searchParams } = new URL(request.url);

    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
    );

    // Validate table name to prevent injection
    const validTables = await getTableNames();
    if (!validTables.includes(tableName)) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 },
      );
    }

    const offset = page * limit;
    const data = await getTableData(tableName, limit, offset);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching table data:", error);
    return NextResponse.json(
      { error: "Failed to fetch table data" },
      { status: 500 },
    );
  }
}
