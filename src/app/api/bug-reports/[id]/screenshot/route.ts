import { adminAccess, getSession } from "@/server/auth/session";
import { intId } from "@/server/admin/form";
import { findViewableScreenshot } from "@/server/bug-reports/reports";
import { getStorage } from "@/server/storage";

// GET /api/bug-reports/[id]/screenshot: a problem report's screenshot, for the
// person who sent it or an admin who may use the error log. Anyone else
// (signed out, another user, a wrong id) gets the same 404.

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/api/bug-reports/[id]/screenshot">) {
  const session = await getSession();
  if (!session) return notFound();
  const id = intId.safeParse((await params).id);
  if (!id.success) return notFound();

  const file = await findViewableScreenshot(id.data, {
    id: session.user.id,
    isAdmin: adminAccess(session, "errors") === "ok",
  });
  if (!file) return notFound();
  const stored = await getStorage().get(file.key);
  if (!stored) {
    console.error(`[reports] screenshot missing from storage: report ${id.data}`);
    return notFound();
  }
  return new Response(stored.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(stored.size),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
