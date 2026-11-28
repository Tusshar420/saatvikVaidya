"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import {
  createProduct,
  deleteProductImage,
  imageAltSchema,
  imageVariantSchema,
  moveProductImage,
  parseProductForm,
  parseVariantsForm,
  saveProductVariants,
  updateProduct,
  updateProductImageDetails,
} from "@/server/admin/catalogue";
import { formValues, intId, type FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

// Server actions for /admin/catalogue. Each checks the admin session itself
// and validates with Zod. Catalogue pages read the database on every request,
// so only the admin pages need refreshing. Image uploads go through
// /api/admin/products/[id]/images instead (server actions cap bodies at 1 MB).

const editPath = (id: number) => `/admin/catalogue/${id}/edit`;

function afterChange() {
  revalidatePath("/admin", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/launch", "layout");
}

export async function createProductAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("catalogue");
  const values = formValues(formData);
  const parsed = parseProductForm(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  const result = await createProduct(parsed.data, user.id);
  if (!result.ok) return { status: "error", fieldErrors: result.fieldErrors, values };
  afterChange();
  // Straight to the edit page, where images can be added.
  redirect(`${editPath(result.id)}?notice=created`);
}

export async function updateProductAction(
  rawId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("catalogue");
  const id = intId.safeParse(rawId);
  if (!id.success) notFound();
  const values = formValues(formData);
  const parsed = parseProductForm(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  const result = await updateProduct(id.data, parsed.data, user.id);
  if (!result) return { status: "error", message: copy.common.notFound };
  if (!result.ok) return { status: "error", fieldErrors: result.fieldErrors, values };
  afterChange();
  redirect("/admin/catalogue?notice=saved");
}

export async function deleteProductImageAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("catalogue");
  const id = intId.safeParse(formData.get("id"));
  if (!id.success) notFound();
  const result = await deleteProductImage(id.data, user.id);
  if (!result) notFound();
  afterChange();
  redirect(`${editPath(result.productId)}?notice=deleted#images`);
}

const moveSchema = z.object({
  id: intId,
  direction: z.enum(["up", "down"]),
});

export async function moveProductImageAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("catalogue");
  const parsed = moveSchema.safeParse({
    id: formData.get("id"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) notFound();
  const result = await moveProductImage(parsed.data.id, parsed.data.direction, user.id);
  if (!result) notFound();
  afterChange();
}

export async function updateProductImageAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("catalogue");
  const id = intId.safeParse(formData.get("id"));
  if (!id.success) notFound();
  const alt = imageAltSchema.safeParse(formData.get("alt"));
  const variant = imageVariantSchema.safeParse(formData.get("variant"));
  if (!alt.success || !variant.success) {
    return {
      status: "error",
      fieldErrors: {
        ...(alt.success ? {} : { alt: copy.catalogue.images.errors.alt }),
        ...(variant.success
          ? {}
          : { variant: copy.catalogue.images.errors.variant }),
      },
      values: formValues(formData),
    };
  }
  const result = await updateProductImageDetails(
    id.data,
    { alt: alt.data, variant: variant.data },
    user.id,
  );
  if (!result) return { status: "error", message: copy.common.notFound };
  if ("error" in result) {
    return {
      status: "error",
      fieldErrors: { variant: copy.catalogue.images.errors.variant },
      values: formValues(formData),
    };
  }
  afterChange();
  return { status: "success", message: copy.common.notices.saved };
}

/** Saves a Build Your Brand product's label variants (names, colours, order). */
export async function saveVariantsAction(
  productId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("catalogue");
  const parsed = parseVariantsForm((field) => formData.getAll(field));
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };
  const result = await saveProductVariants(productId, parsed.variants, user.id);
  if (!result) return { status: "error", message: copy.common.notFound };
  if ("error" in result) {
    return { status: "error", message: copy.catalogue.variants.errors.unknownKey };
  }
  afterChange();
  return { status: "success", message: copy.common.notices.saved };
}
