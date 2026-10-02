import { NextResponse } from "next/server";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { brandLogoUpload } from "@/lib/brand";
import { formatFileSize } from "@/lib/verification";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { getSession } from "@/server/auth/session";
import { draftLogoFile, saveDraftLogo, type LogoUploadError } from "@/server/brand/drafts";
import { logoNotFound, logoResponse } from "@/server/brand/logo-response";
import { isSameOrigin } from "@/server/request-origin";
import { readBodyWithLimit } from "@/server/storage/files";

// /api/launch/logo (P2.1): the signed-in user's Launch Your Brand logo.
// - POST uploads it (multipart form with one "file"): PNG, JPEG or PDF,
//   type checked from the bytes, up to 5 MB. A route handler rather than a
//   server action, for the larger body. Replies with JSON:
//   { ok: true } or { ok: false, error, message }.
// - GET serves the draft's logo to its owner only (404 for anyone else).

/** Room for the multipart boundaries. */
const FORM_OVERHEAD_BYTES = 16 * 1024;

const errors = copy.packaging.logo.errors;
const maxSize = formatFileSize(brandLogoUpload.maxBytes);

type ErrorCode = LogoUploadError | "signedOut" | "rateLimited" | "failed";

const failures: Record<ErrorCode, { status: number; message: string }> = {
  signedOut: { status: 401, message: errors.signedOut },
  noDraft: { status: 409, message: copy.cart.empty.title },
  empty: { status: 400, message: errors.empty },
  tooLarge: { status: 413, message: errors.tooLarge(maxSize) },
  fileType: { status: 415, message: errors.fileType },
  rateLimited: { status: 429, message: errors.rateLimited },
  failed: { status: 400, message: errors.failed },
};

function fail(error: ErrorCode, headers?: HeadersInit) {
  const { status, message } = failures[error];
  return NextResponse.json({ ok: false, error, message }, { status, headers });
}

const formSchema = z.object({ file: z.instanceof(File) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return fail("signedOut");

  const limit = await hitRateLimit(rateLimitRules.brandLogoUploadPerUser, session.user.id);
  if (!limit.allowed) {
    return fail("rateLimited", { "Retry-After": String(limit.retryAfterSeconds) });
  }

  const body = await readBodyWithLimit(request, brandLogoUpload.maxBytes + FORM_OVERHEAD_BYTES);
  if (!body) return fail("tooLarge");

  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail("failed");
  }
  const parsed = formSchema.safeParse({ file: form.get("file") });
  if (!parsed.success) return fail("failed");
  const { file } = parsed.data;
  if (file.size > brandLogoUpload.maxBytes) return fail("tooLarge");

  const result = await saveDraftLogo({
    userId: session.user.id,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return fail(result.error);
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return logoNotFound();
  const file = await draftLogoFile(session.user.id);
  if (!file) return logoNotFound();
  return logoResponse(request, file);
}
