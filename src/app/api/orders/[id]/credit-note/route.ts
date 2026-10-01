import { orderDocumentResponse } from "@/server/invoices/download";

// GET /api/orders/[id]/credit-note: the credit note of a paid order that was
// cancelled (PDF), for its buyer or an admin; 404 otherwise. See
// src/server/invoices/download.ts.
export async function GET(_request: Request, { params }: RouteContext<"/api/orders/[id]/credit-note">) {
  return orderDocumentResponse("credit_note", (await params).id);
}
