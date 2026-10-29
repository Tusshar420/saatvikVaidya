import { NextResponse } from "next/server";
import { z } from "zod";
import { reportProblem as copy } from "@/content/bug-reports";
import { getSession } from "@/server/auth/session";
import { isSameOrigin, requestIp } from "@/server/request-origin";
import { submitBugReport, type SubmitError } from "@/server/bug-reports/submit";
import { readBodyWithLimit } from "@/server/storage/files";
import { screenshotUpload } from "@/lib/bug-report";

// POST /api/bug-reports: "Report a problem" (Phase 4), from signed-in users and
// guests. Same-origin only, size-capped, rate-limited, with a honeypot (see
// submitBugReport). A multipart form, so a screenshot can come along.
// Replies { ok: true } or { ok: false, error, message }.

/** Room for the text fields (the visit's errors are the largest) and boundaries. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

type ErrorCode = SubmitError | "failed";

const errors: Record<ErrorCode, { status: number; message: string }> = {
  invalid: { status: 400, message: copy.errors.invalid },
  tooManyLinks: { status: 400, message: copy.errors.tooManyLinks },
  empty: { status: 400, message: copy.errors.fileType },
  fileType: { status: 415, message: copy.errors.fileType },
  tooLarge: { status: 413, message: copy.errors.tooLarge },
  rateLimited: { status: 429, message: copy.errors.rateLimited },
  failed: { status: 400, message: copy.errors.failed },
};

function fail(error: ErrorCode, headers?: HeadersInit) {
  const { status, message } = errors[error];
  return NextResponse.json({ ok: false, error, message }, { status, headers });
}

const textField = z.string().max(40_000);
const fieldNames = [
  "description",
  "contactEmail",
  "website",
  "pageUrl",
  "screenWidth",
  "screenHeight",
  "viewportWidth",
  "viewportHeight",
  "pixelRatio",
  "sessionErrors",
] as const;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = await readBodyWithLimit(request, screenshotUpload.maxBytes + FORM_OVERHEAD_BYTES);
  if (!body) return fail("tooLarge");

  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail("failed");
  }
  // Only the known text fields go on; anything else in the form is dropped.
  const fields: Record<string, string> = {};
  for (const name of fieldNames) {
    const parsed = textField.safeParse(form.get(name));
    if (parsed.success) fields[name] = parsed.data;
  }
  const file = form.get("screenshot");
  const screenshot = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;

  const session = await getSession().catch(() => null);
  const result = await submitBugReport({
    fields,
    screenshot,
    ip: await requestIp(),
    userAgent: request.headers.get("user-agent"),
    userId: session?.user.id ?? null,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
  });
  if (!result.ok) {
    return fail(
      result.error,
      result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined,
    );
  }
  return NextResponse.json({ ok: true });
}
