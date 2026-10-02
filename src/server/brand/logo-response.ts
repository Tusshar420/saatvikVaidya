import "server-only";
import { isImageLogo } from "@/lib/brand";
import { getStorage } from "@/server/storage";
import { contentDisposition } from "@/server/storage/files";

// Serving a Launch Your Brand logo (P2.1) to someone the caller has already
// checked may see it. PNG and JPEG open in the browser (for the preview) or
// download with ?download=1; PDFs always download, so no PDF viewer runs
// under our CSP. Nothing is cached.

export function logoNotFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function logoResponse(
  request: Request,
  file: { key: string; name: string; contentType: string },
): Promise<Response> {
  const stored = await getStorage().get(file.key);
  if (!stored) {
    console.error(`[brand] logo missing from storage: ${file.key}`);
    return logoNotFound();
  }
  const download =
    !isImageLogo(file.contentType) || new URL(request.url).searchParams.get("download") === "1";
  return new Response(stored.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(stored.size),
      "Content-Disposition": contentDisposition(download ? "attachment" : "inline", file.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
