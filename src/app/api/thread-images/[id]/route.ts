import { getSession } from "@/server/auth/session";
import { intId } from "@/server/admin/form";
import { getStorage } from "@/server/storage";
import { findViewableThreadImage } from "@/server/threads/threads";

// GET /api/thread-images/[id]: an image shared in a Dr. Talk thread, for any
// signed-in member (like the threads themselves). Signed-out visitors, a
// wrong id or a hidden thread get the same 404. An id always points at the
// same file, so the browser may keep it for a while.

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/api/thread-images/[id]">) {
  const session = await getSession();
  if (!session) return notFound();
  const id = intId.safeParse((await params).id);
  if (!id.success) return notFound();

  const image = await findViewableThreadImage(id.data);
  if (!image) return notFound();
  const stored = await getStorage().get(image.key);
  if (!stored) {
    console.error(`[threads] image missing from storage: image ${id.data}`);
    return notFound();
  }
  return new Response(stored.body, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(stored.size),
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
