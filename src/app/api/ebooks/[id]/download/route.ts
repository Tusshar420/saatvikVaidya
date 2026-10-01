import { intId } from "@/server/admin/form";
import { getSession } from "@/server/auth/session";
import { openEbookDownload } from "@/server/ebooks/ebooks";
import { contentDisposition } from "@/server/storage/files";

// GET /api/ebooks/[id]/download: streams an ebook's PDF to someone allowed to
// have it (see src/server/ebooks/ebooks.ts): any signed-in user for a free
// book, buyers for a paid one, and only while downloads are switched on.
// Everyone else gets the same 404; too many downloads get a 429.

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/api/ebooks/[id]/download">) {
  const id = intId.safeParse((await params).id);
  if (!id.success) return notFound();
  const session = await getSession();
  const result = await openEbookDownload(
    id.data,
    session ? { id: session.user.id, role: session.user.role ?? "user" } : null,
  );
  if (!result.ok) {
    if (result.error === "rate_limited") {
      return new Response("Too many downloads. Please try again later.", {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": String(result.retryAfterSeconds ?? 60),
        },
      });
    }
    return notFound();
  }
  return new Response(result.file.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(result.file.size),
      "Content-Disposition": contentDisposition("attachment", result.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
