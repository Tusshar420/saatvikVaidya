import { effectiveRole, getSession } from "@/server/auth/session";
import { brandOrderLogoFile } from "@/server/brand/orders";
import { logoNotFound, logoResponse } from "@/server/brand/logo-response";

// GET /api/brand-orders/[id]/logo (P2.1): a brand order's logo, for the
// order's owner or an admin who can see orders. Anyone else (signed out,
// another user, a wrong id) gets the same 404. Add ?download=1 to save an
// image instead of opening it.

export async function GET(request: Request, { params }: RouteContext<"/api/brand-orders/[id]/logo">) {
  const session = await getSession();
  if (!session) return logoNotFound();
  const file = await brandOrderLogoFile((await params).id, {
    userId: session.user.id,
    isAdmin: effectiveRole(session, "orders") === "admin",
  });
  if (!file) return logoNotFound();
  return logoResponse(request, file);
}
