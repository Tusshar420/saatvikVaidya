import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { admin } from "@/content/admin";
import { formatFileSize } from "@/lib/verification";
import {
  ebookUploadRules,
  uploadEbookFile,
  type EbookUploadError,
} from "@/server/admin/ebooks";
import { intId } from "@/server/admin/form";
import { getSession } from "@/server/auth/session";
import { isSameOrigin } from "@/server/request-origin";
import { readBodyWithLimit } from "@/server/storage/files";

// POST /api/admin/ebooks/[id]/files: an admin uploads an ebook's cover or its
// PDF (multipart form: kind = "cover" | "file", file). A route handler rather
// than a server action, because server actions cap bodies at 1 MB. Signed-out
// visitors and non-admins get a 404, like the rest of the admin area.
// Replies with JSON: { ok: true } or { ok: false, error, message }.

const copy = admin.ebooks.files.errors;

/** Room for the multipart boundaries and the other fields. */
const FORM_OVERHEAD_BYTES = 16 * 1024;

type ErrorCode = EbookUploadError | "failed";

function fail(error: ErrorCode, kind: keyof typeof ebookUploadRules = "file") {
  const maxSize = formatFileSize(ebookUploadRules[kind].maxBytes);
  const { status, message } = {
    notFound: { status: 404, message: copy.notFound },
    empty: { status: 400, message: copy.empty },
    tooLarge: { status: 413, message: copy.tooLarge(maxSize) },
    fileType: { status: 415, message: copy.fileType },
    failed: { status: 400, message: copy.failed },
  }[error];
  return NextResponse.json({ ok: false, error, message }, { status });
}

const notFound = () => NextResponse.json({ ok: false, error: "notFound" }, { status: 404 });

const kindSchema = z.enum(["cover", "file"]);

export async function POST(request: Request, { params }: RouteContext<"/api/admin/ebooks/[id]/files">) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const session = await getSession();
  if (session?.user.role !== "admin") return notFound();
  const ebookId = intId.safeParse((await params).id);
  if (!ebookId.success) return notFound();

  const body = await readBodyWithLimit(
    request,
    ebookUploadRules.file.maxBytes + FORM_OVERHEAD_BYTES,
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
  const kind = kindSchema.safeParse(form.get("kind"));
  if (!kind.success) return fail("failed");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("empty", kind.data);
  if (file.size > ebookUploadRules[kind.data].maxBytes) return fail("tooLarge", kind.data);

  const result = await uploadEbookFile({
    ebookId: ebookId.data,
    kind: kind.data,
    bytes: new Uint8Array(await file.arrayBuffer()),
    fileName: file.name,
    actorId: session.user.id,
  });
  if (!result.ok) return fail(result.error, kind.data);
  revalidatePath("/admin/ebooks", "layout");
  revalidatePath("/ebooks", "layout");
  return NextResponse.json({ ok: true });
}
