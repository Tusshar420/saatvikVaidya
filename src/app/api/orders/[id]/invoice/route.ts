import { orderDocumentResponse } from "@/server/invoices/download";

// GET /api/orders/[id]/invoice: the order's GST tax invoice (PDF), for its
// buyer or an admin; 404 for anyone else or an unpaid order. See
// src/server/invoices/download.ts.
export async function GET(_request: Request, { params }: RouteContext<"/api/orders/[id]/invoice">) {
  return orderDocumentResponse("invoice", (await params).id);
}
