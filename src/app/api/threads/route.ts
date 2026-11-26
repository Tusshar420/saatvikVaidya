import { NextResponse } from "next/server";
import { z } from "zod";
import { threads as copy } from "@/content/threads";
import { pollLimits, threadImageUpload } from "@/lib/threads";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { getSession } from "@/server/auth/session";
import { isSameOrigin } from "@/server/request-origin";
import { readBodyWithLimit } from "@/server/storage/files";
import { createThread } from "@/server/threads/threads";

// POST /api/threads: "Start a thread" in Dr. Talk. A multipart form (not a
// server action) so up to four images can come along. Same-origin only,
// size-capped and rate-limited; createThread checks the writer is a verified
// doctor and checks every image from its bytes. The author is the session's
// user. Replies { ok: true, id } or { ok: false, message, fieldErrors? }.

/** Room for the text fields and the multipart boundaries. */
const FORM_OVERHEAD_BYTES = 64 * 1024;
const MAX_BYTES = threadImageUpload.maxCount * threadImageUpload.maxBytes + FORM_OVERHEAD_BYTES;

const textField = z.string().max(20_000);
const fieldNames = ["kind", "title", "body", "poll"] as const;

function fail(status: number, message: string, fieldErrors?: Record<string, string>) {
  return NextResponse.json({ ok: false, message, fieldErrors }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, copy.errors.forbidden);
  const session = await getSession();
  if (!session) return fail(401, copy.errors.forbidden);
  if (!(await hitRateLimit(rateLimitRules.threadWritePerUser, session.user.id)).allowed) {
    return fail(429, copy.errors.rateLimited);
  }
  const body = await readBodyWithLimit(request, MAX_BYTES);
  if (!body) return fail(413, copy.errors.imageTooLarge, { images: copy.errors.imageTooLarge });

  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail(400, copy.errors.generic);
  }
  // Only the known fields go on; anything else in the form is dropped.
  const values: Record<string, string> = {};
  for (const name of fieldNames) {
    const parsed = textField.safeParse(form.get(name));
    if (parsed.success) values[name] = parsed.data;
  }
  // The form names its poll boxes pollOption1…pollOption6; "poll" is on while the poll part is open.
  const pollOptions =
    values.poll === "on"
      ? Array.from({ length: pollLimits.max }, (_, i) => {
          const parsed = textField.safeParse(form.get(`pollOption${i + 1}`));
          return parsed.success ? parsed.data : "";
        })
      : undefined;
  const files = form.getAll("images").filter((file): file is File => file instanceof File && file.size > 0);
  const images = await Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer())));

  const result = await createThread(session.user.id, { ...values, pollOptions }, images);
  if (!result.ok) {
    if (result.error === "forbidden") return fail(403, copy.errors.forbidden);
    return fail(400, copy.errors.generic, result.fieldErrors);
  }
  return NextResponse.json({ ok: true, id: result.id });
}
