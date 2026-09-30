import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTableData, isTableName } from "@/server/admin/schema";
import { getSession } from "@/server/auth/session";

const querySchema = z.object({
  page: z.coerce.number().int().min(0).max(100_000).catch(0),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
});

/**
 * A page of rows for the database browser. Admins only: anyone else gets
 * the same 404 as an unknown table, so the route doesn't reveal itself.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/tables/[table]">,
) {
  const session = await getSession();
  const notFound = NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session?.user.role !== "admin") return notFound;

  const { table } = await params;
  if (!(await isTableName(table))) return notFound;

  const { page, limit } = querySchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  try {
    const data = await getTableData(table, limit, page * limit);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Admin table read failed.", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
