import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { isSameOrigin, requestIp } from "@/server/request-origin";
import { handleBrowserReport, maxReportBytes } from "@/server/errors/report";

// Browser error reports (Phase 4). Public on purpose (visitors aren't signed
// in), so it is same-origin only, size-capped and rate-limited per IP and per
// account. It always answers 204 for accepted-or-ignored reports so the page
// never learns anything, and never stores request bodies wholesale: only the
// fields in browserReportSchema, scrubbed.

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxReportBytes) return new NextResponse(null, { status: 413 });
  const text = await request.text();
  if (text.length > maxReportBytes) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const session = await getSession().catch(() => null);
  const outcome = await handleBrowserReport({
    body,
    ip: await requestIp(),
    userAgent: request.headers.get("user-agent"),
    userId: session?.user.id ?? null,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
  });
  if (outcome === "invalid") return new NextResponse(null, { status: 400 });
  if (outcome === "rate-limited") {
    return new NextResponse(null, { status: 429, headers: { "Retry-After": "600" } });
  }
  return new NextResponse(null, { status: 204 });
}
