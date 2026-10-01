import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { admin } from "@/content/admin";
import { MAX_PRODUCT_IMAGES, productImageUpload } from "@/lib/catalogue";
import { formatFileSize } from "@/lib/verification";
import {
  addProductImage,
  imageAltSchema,
  type ImageUploadError,
} from "@/server/admin/catalogue";
import { intId } from "@/server/admin/form";
import { getSession } from "@/server/auth/session";
import { readBodyWithLimit } from "@/server/storage/files";
import { isSameOrigin } from "@/server/request-origin";

// POST /api/admin/products/[id]/images: an admin adds a product photo
// (multipart form: file, alt). A route handler rather than a server action,
// because server actions cap request bodies at 1 MB. Signed-out visitors and
// non-admins get a 404, like the rest of the admin area. Replies with JSON:
// { ok: true, id } or { ok: false, error, message }.

const copy = admin.catalogue.images.errors;

/** Room for the multipart boundaries and the alt text. */
const FORM_OVERHEAD_BYTES = 16 * 1024;

type ErrorCode = ImageUploadError | "alt" | "failed";

const maxSize = formatFileSize(productImageUpload.maxBytes);

const errors: Record<ErrorCode, { status: number; message: string }> = {
  notFound: { status: 404, message: copy.notFound },
  tooMany: { status: 409, message: copy.tooMany(MAX_PRODUCT_IMAGES) },
  empty: { status: 400, message: copy.empty },
  tooLarge: { status: 413, message: copy.tooLarge(maxSize) },
  fileType: { status: 415, message: copy.fileType },
  alt: { status: 400, message: copy.alt },
  failed: { status: 400, message: copy.failed },
};

function fail(error: ErrorCode) {
  const { status, message } = errors[error];
  return NextResponse.json({ ok: false, error, message }, { status });
}

const notFound = () =>
  NextResponse.json({ ok: false, error: "notFound" }, { status: 404 });

const formSchema = z.object({
  alt: imageAltSchema,
  file: z.instanceof(File),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/admin/products/[id]/images">,
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const session = await getSession();
  if (session?.user.role !== "admin") return notFound();
  const productId = intId.safeParse((await params).id);
  if (!productId.success) return notFound();

  const body = await readBodyWithLimit(
    request,
    productImageUpload.maxBytes + FORM_OVERHEAD_BYTES,
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
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("empty");
  const parsed = formSchema.safeParse({ alt: form.get("alt"), file });
  if (!parsed.success) return fail("alt");
  if (file.size > productImageUpload.maxBytes) return fail("tooLarge");

  const result = await addProductImage({
    productId: productId.data,
    bytes: new Uint8Array(await file.arrayBuffer()),
    alt: parsed.data.alt,
    actorId: session.user.id,
  });
  if (!result.ok) return fail(result.error);
  revalidatePath("/admin/catalogue", "layout");
  return NextResponse.json({ ok: true, id: result.id });
}
