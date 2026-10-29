import { NextResponse } from "next/server";
import { z } from "zod";
import { verification as copy } from "@/content/verification";
import { documentUpload, formatFileSize } from "@/lib/verification";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { getSession } from "@/server/auth/session";
import { isSameOrigin } from "@/server/request-origin";
import { readBodyWithLimit } from "@/server/storage/files";
import {
  uploadDocument,
  type UploadError,
} from "@/server/verification/documents";

// POST /api/account/documents: a signed-in professional uploads one document
// (multipart form: documentType, file). A route handler rather than a server
// action, so the browser can report upload progress. Replies with JSON:
// { ok: true, complete } or { ok: false, error, message }.

/** Room for the multipart boundaries and the documentType field. */
const FORM_OVERHEAD_BYTES = 16 * 1024;

const maxSize = formatFileSize(documentUpload.maxBytes);

type ErrorCode = UploadError | "signedOut" | "rateLimited" | "failed";

const errors: Record<ErrorCode, { status: number; message: string }> = {
  signedOut: { status: 401, message: copy.errors.signedOut },
  notProfessional: { status: 403, message: copy.errors.notProfessional },
  locked: { status: 409, message: copy.errors.locked },
  documentType: { status: 400, message: copy.errors.documentType },
  empty: { status: 400, message: copy.errors.empty },
  tooLarge: { status: 413, message: copy.errors.tooLarge(maxSize) },
  fileType: { status: 415, message: copy.errors.fileType },
  rateLimited: { status: 429, message: copy.errors.rateLimited },
  failed: { status: 400, message: copy.errors.failed },
};

function fail(error: ErrorCode, headers?: HeadersInit) {
  const { status, message } = errors[error];
  return NextResponse.json({ ok: false, error, message }, { status, headers });
}

const formSchema = z.object({
  documentType: z.string().trim().min(1).max(40),
  file: z.instanceof(File),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return fail("signedOut");

  const limit = await hitRateLimit(
    rateLimitRules.documentUploadPerUser,
    session.user.id,
  );
  if (!limit.allowed) {
    return fail("rateLimited", { "Retry-After": String(limit.retryAfterSeconds) });
  }

  const body = await readBodyWithLimit(
    request,
    documentUpload.maxBytes + FORM_OVERHEAD_BYTES,
  );
  if (!body) return fail("tooLarge");

  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail("failed");
  }
  const parsed = formSchema.safeParse({
    documentType: form.get("documentType"),
    file: form.get("file"),
  });
  if (!parsed.success) return fail("failed");
  const { documentType, file } = parsed.data;
  if (file.size > documentUpload.maxBytes) return fail("tooLarge");

  const result = await uploadDocument({
    userId: session.user.id,
    documentType,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return fail(result.error);
  return NextResponse.json({ ok: true, complete: result.complete });
}
