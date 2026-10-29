import { intId } from "@/server/admin/form";
import { findServableCover } from "@/server/ebooks/ebooks";
import { getStorage } from "@/server/storage";

// GET /api/ebook-covers/[id]: an ebook's cover image. Covers are public (the
// book file is not; see /api/ebooks/[id]/download). The link carries a
// version from the cover's key, so it can be cached.

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/api/ebook-covers/[id]">) {
  const id = intId.safeParse((await params).id);
  if (!id.success) return notFound();
  const cover = await findServableCover(id.data);
  if (!cover) return notFound();
  const stored = await getStorage().get(cover.fileKey);
  if (!stored) {
    console.error(`[ebook-covers] file missing from storage: ebook ${id.data}`);
    return notFound();
  }
  return new Response(stored.body, {
    headers: {
      "Content-Type": cover.contentType,
      "Content-Length": String(stored.size),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
