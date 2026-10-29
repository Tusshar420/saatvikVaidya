import "server-only";
import { effectiveRole, getSession } from "@/server/auth/session";
import { contentDisposition } from "@/server/storage/files";
import type { InvoiceKind } from "./gst";
import { openOrderDocument } from "./invoices";

// The response for /api/orders/[id]/invoice and /api/orders/[id]/credit-note
// (P1.6): the PDF for the order's buyer or an admin, always as a download.
// Anyone else (signed out, another user, a wrong id) and an order without
// that document get the same 404, so the routes don't reveal which orders
// exist.

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function orderDocumentResponse(kind: InvoiceKind, orderId: string): Promise<Response> {
  const session = await getSession();
  if (!session) return notFound();
  const document = await openOrderDocument(orderId, kind, {
    id: session.user.id,
    role: effectiveRole(session, "orders"),
  });
  if (!document) return notFound();
  return new Response(document.file.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(document.file.size),
      "Content-Disposition": contentDisposition("attachment", document.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
