import { effectiveRole, getSession } from "@/server/auth/session";
import { logoNotFound, logoResponse } from "@/server/brand/logo-response";
import { brandProofFile } from "@/server/brand/stages";

// GET /api/brand-orders/[id]/proofs/[version] (P2.2): one version of a label
// proof, for the order's owner or an admin who can see orders. Anyone else
// (signed out, another user, a wrong id or version) gets the same 404.
// PNG and JPEG open in the browser; PDFs, and ?download=1, download.

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/brand-orders/[id]/proofs/[version]">,
) {
  const session = await getSession();
  if (!session) return logoNotFound();
  const { id, version } = await params;
  const file = await brandProofFile(id, /^\d{1,6}$/.test(version) ? Number(version) : 0, {
    userId: session.user.id,
    isAdmin: effectiveRole(session, "orders") === "admin",
  });
  if (!file) return logoNotFound();
  return logoResponse(request, file);
}
