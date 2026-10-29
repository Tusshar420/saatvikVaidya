import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { markNotificationRead, unreadCount } from "@/server/notifications/notifications";
import { isSameOrigin } from "@/server/request-origin";

// POST /api/notifications/:id/read: marks one of the signed-in user's
// notifications read, when they open it. Sent with `keepalive`, so it lands
// even though the browser is already moving to the notification's page.
// Someone else's notification answers 404, like one that doesn't exist.

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

const noStore = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: noStore });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "signedOut" }, { status: 401, headers: noStore });
  }
  const id = idSchema.safeParse((await params).id);
  if (!id.success || !(await markNotificationRead(session.user.id, id.data))) {
    return NextResponse.json({ ok: false, error: "notFound" }, { status: 404, headers: noStore });
  }
  return NextResponse.json(
    { ok: true, unread: await unreadCount(session.user.id) },
    { headers: noStore },
  );
}
