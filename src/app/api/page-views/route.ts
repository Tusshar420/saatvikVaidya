import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { isSameOrigin, requestIp } from "@/server/request-origin";
import { handlePageView, maxPageViewBytes } from "@/server/analytics/page-views";

// Page views for Traffic (/admin/traffic). Public on purpose (most visitors
// aren't signed in), so it is same-origin only, size-capped and capped per
// IP. It answers 204 whether the view was counted, ignored or over the cap, and a failure
// here never reaches the page: the browser doesn't wait for the answer.

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxPageViewBytes) return new NextResponse(null, { status: 413 });
  const text = await request.text();
  if (text.length > maxPageViewBytes) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const session = await getSession().catch(() => null);
  const outcome = await handlePageView({
    body,
    ip: await requestIp(),
    userAgent: request.headers.get("user-agent"),
    user: session
      ? { role: session.user.role ?? null, userTypeId: session.user.userTypeId ?? null }
      : null,
  });
  if (outcome === "invalid") return new NextResponse(null, { status: 400 });
  // Over the per-IP cap the view is dropped, but the answer is still 204: a
  // 429 shows as a red console error, and many phones share one IP (mobile
  // networks), so real visitors could see it.
  return new NextResponse(null, { status: 204 });
}
