import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { markAllNotificationsRead } from "@/server/notifications/notifications";
import { isSameOrigin } from "@/server/request-origin";

// POST /api/notifications/read-all: "Mark all as read" for the signed-in user.

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: noStore });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "signedOut" }, { status: 401, headers: noStore });
  }
  const changed = await markAllNotificationsRead(session.user.id);
  return NextResponse.json({ ok: true, changed, unread: 0 }, { headers: noStore });
}
