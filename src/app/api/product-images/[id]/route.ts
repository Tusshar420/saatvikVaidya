import { getSession } from "@/server/auth/session";
import { intId } from "@/server/admin/form";
import { findServableProductImage } from "@/server/catalogue/products";
import { getStorage } from "@/server/storage";

// GET /api/product-images/[id]: a product photo. Photos of active products
// are public; photos of hidden products are for admins only (the admin
// preview). Everything else gets the same 404. An image id always points at
// the same file (a new upload gets a new id), so public photos can be cached.

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/product-images/[id]">,
) {
  const id = intId.safeParse((await params).id);
  if (!id.success) return notFound();

  let image = await findServableProductImage(id.data, false);
  if (!image) {
    // Only look up the session when it matters (hidden products).
    const session = await getSession();
    if (session?.user.role !== "admin") return notFound();
    image = await findServableProductImage(id.data, true);
    if (!image) return notFound();
  }

  const stored = await getStorage().get(image.fileKey);
  if (!stored) {
    console.error(`[product-images] file missing from storage: image ${id.data}`);
    return notFound();
  }
  return new Response(stored.body, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(stored.size),
      "Cache-Control": image.public
        ? "public, max-age=86400, stale-while-revalidate=604800"
        : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
