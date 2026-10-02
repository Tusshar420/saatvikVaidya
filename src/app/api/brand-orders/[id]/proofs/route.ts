import { NextResponse } from "next/server";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { brandProofUpload, proofNoteMax } from "@/lib/brand-stage";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { getAdminSession } from "@/server/auth/session";
import { uploadProof, type StageError } from "@/server/brand/stages";
import { isSameOrigin } from "@/server/request-origin";
import { readBodyWithLimit } from "@/server/storage/files";

// POST /api/brand-orders/[id]/proofs (P2.2): an orders admin sends a label
// proof (multipart form: "file" and an optional "note"). PDF, PNG or JPEG,
// type checked from the bytes, up to 10 MB. A route handler rather than a
// server action, for the larger body. Replies with JSON:
// { ok: true, version } or { ok: false, error, message }.

/** Room for the multipart boundaries and the note. */
const FORM_OVERHEAD_BYTES = 32 * 1024;

const results = copy.admin.detail.results;

type ErrorCode = StageError | "rateLimited" | "noFile" | "failed";

const failures: Record<ErrorCode, { status: number; message: string }> = {
  not_found: { status: 404, message: results.not_found },
  not_paid: { status: 409, message: results.not_paid },
  not_allowed: { status: 409, message: results.not_allowed },
  no_proof: { status: 409, message: results.no_proof },
  invalid: { status: 400, message: results.invalid },
  empty: { status: 400, message: results.empty },
  tooLarge: { status: 413, message: results.tooLarge },
  fileType: { status: 415, message: results.fileType },
  shipping_off: { status: 409, message: results.shipping_off },
  rateLimited: { status: 429, message: results.rateLimited },
  noFile: { status: 400, message: results.noFile },
  failed: { status: 400, message: results.generic },
};

function fail(error: ErrorCode, headers?: HeadersInit) {
  const { status, message } = failures[error];
  return NextResponse.json({ ok: false, error, message }, { status, headers });
}

const formSchema = z.object({
  file: z.instanceof(File),
  note: z.string().trim().max(proofNoteMax).optional(),
});

export async function POST(request: Request, { params }: RouteContext<"/api/brand-orders/[id]/proofs">) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const session = await getAdminSession("orders");
  if (!session) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const limit = await hitRateLimit(rateLimitRules.brandProofUploadPerAdmin, session.user.id);
  if (!limit.allowed) return fail("rateLimited", { "Retry-After": String(limit.retryAfterSeconds) });

  const body = await readBodyWithLimit(request, brandProofUpload.maxBytes + FORM_OVERHEAD_BYTES);
  if (!body) return fail("tooLarge");
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail("failed");
  }
  const rawNote = form.get("note");
  const parsed = formSchema.safeParse({
    file: form.get("file"),
    note: typeof rawNote === "string" ? rawNote : undefined,
  });
  if (!parsed.success) return fail(form.get("file") instanceof File ? "invalid" : "noFile");
  const { file, note } = parsed.data;
  if (file.size > brandProofUpload.maxBytes) return fail("tooLarge");

  const result = await uploadProof({
    actorId: session.user.id,
    orderId: (await params).id,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    note: note || null,
  });
  if (!result.ok) return fail(result.error);
  return NextResponse.json({ ok: true, version: result.version });
}
