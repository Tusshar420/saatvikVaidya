import { NextResponse } from "next/server";
import { z } from "zod";
import { notificationFilters, panelLimit, pageLimit } from "@/lib/notifications";
import { getSession } from "@/server/auth/session";
import { listNotifications, unreadBySection, unreadCount } from "@/server/notifications/notifications";

// GET /api/notifications?filter=all|unread|read&limit=8: the signed-in
// user's newest notifications and their unread count, for the header's bell.
// Replies { ok: true, unread, sections, items } or 401 when signed out. Never cached.

const querySchema = z.object({
  filter: z.enum(notificationFilters).default("all"),
  limit: z.coerce.number().int().min(1).max(pageLimit).default(panelLimit),
});

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "signedOut" }, { status: 401, headers: noStore });
  }
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    filter: params.get("filter") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  }
  const { filter, limit } = parsed.data;
  const [items, unread, sections] = await Promise.all([
    listNotifications(session.user.id, filter, limit),
    unreadCount(session.user.id),
    unreadBySection(session.user.id),
  ]);
  return NextResponse.json({ ok: true, unread, sections, items }, { headers: noStore });
}
