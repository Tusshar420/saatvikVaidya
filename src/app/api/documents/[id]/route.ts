import { getSession } from "@/server/auth/session";
import { intId } from "@/server/admin/form";
import { getStorage } from "@/server/storage";
import { contentDisposition } from "@/server/storage/files";
import { findViewableDocument } from "@/server/verification/documents";

// GET /api/documents/[id]: a professional document's file, for its owner or
// an admin only. Anyone else (signed out, another user, a wrong id) gets the
// same 404, so the route doesn't reveal which documents exist. Add
// ?download=1 to save the file instead of opening it.
//
// Security headers for this path are set in next.config.ts
// (documentFileHeaders): same-origin framing for the admin preview, and a
// locked-down CSP.

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]">,
) {
  const session = await getSession();
  if (!session) return notFound();
  const id = intId.safeParse((await params).id);
  if (!id.success) return notFound();

  const file = await findViewableDocument(id.data, session.user);
  if (!file) return notFound();
  const stored = await getStorage().get(file.fileKey);
  if (!stored) {
    console.error(`[documents] file missing from storage: document ${id.data}`);
    return notFound();
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(stored.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(stored.size),
      "Content-Disposition": contentDisposition(
        download ? "attachment" : "inline",
        file.fileName,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
