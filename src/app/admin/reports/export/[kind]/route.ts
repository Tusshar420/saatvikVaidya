import { NextResponse, type NextRequest } from "next/server";
import { exportCsv, exportKinds, type ExportKind } from "@/server/admin/export";
import { reportFiltersSchema, resolveRange } from "@/server/admin/reports";
import { getSession } from "@/server/auth/session";

/**
 * GET /admin/reports/export/orders and /users: a CSV download for admins.
 * Anyone else (signed out, customers) gets the same 404 as an unknown kind,
 * so the route doesn't reveal itself. Each export is written to the admin
 * log. With `from` and `to` the file covers that period; without, everything.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/admin/reports/export/[kind]">,
) {
  const session = await getSession();
  const notFound = () => new NextResponse("Not found", { status: 404 });
  if (session?.user.role !== "admin") return notFound();

  const { kind } = await params;
  if (!(exportKinds as readonly string[]).includes(kind)) return notFound();

  const query = Object.fromEntries(request.nextUrl.searchParams);
  const filters = reportFiltersSchema.parse(query);
  const range = filters.from || filters.to ? resolveRange(filters) : undefined;

  try {
    const { csv, fileName } = await exportCsv(session.user.id, kind as ExportKind, range);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Admin CSV export failed.", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
