"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Upload } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { admin as copy } from "@/content/admin";
import type { BrandVariant } from "@/lib/brand-theme";
import { MAX_PRODUCT_IMAGES, productImageUpload } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/verification";
import { idleForm, type FormState } from "@/server/admin/form";
import { ConfirmDelete } from "./confirm-delete";
import { ProductVariants } from "./product-variants";

const text = copy.catalogue.images;
const maxSize = formatFileSize(productImageUpload.maxBytes);

export type ProductImageItem = {
  id: number;
  src: string;
  alt: string;
  /** The Build Your Brand variant key this photo is for; null: a general photo. */
  variant: string | null;
};

export type ProductImagesProps = {
  productId: number;
  images: ProductImageItem[];
  /** Offer "Shows for" (a Build Your Brand product, or photos already marked). */
  variants: boolean;
  /** The product's label variants (for "Shows for", the badges and the editor). */
  variantList: BrandVariant[];
  /** Saves the variant list; bound to the product. */
  variantsAction: (state: FormState, formData: FormData) => Promise<FormState>;
  moveAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  altAction: (state: FormState, formData: FormData) => Promise<FormState>;
};

/**
 * A product's photos: upload, put in order, describe, mark as a Build Your
 * Brand variant's photo, and delete. The main image is the first general one.
 */
export function ProductImages({
  productId,
  images,
  variants,
  variantList,
  variantsAction,
  moveAction,
  deleteAction,
  altAction,
}: ProductImagesProps) {
  const mainId = images.find((image) => image.variant === null)?.id;
  return (
    <section
      id="images"
      aria-labelledby="images-title"
      className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 id="images-title" className="text-h3 text-ink">
        {text.title}
      </h2>
      <p className="mt-1 text-small text-muted">
        {text.description(MAX_PRODUCT_IMAGES, maxSize)}
      </p>
      {variants && <p className="mt-1 text-small text-muted">{text.variantNote}</p>}
      <Link
        href={`/admin/catalogue/photos?product=${productId}`}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-small font-bold text-brand hover:underline"
      >
        <ImagePlus aria-hidden className="size-4" />
        {text.bulkLink}
      </Link>
      {variants && (
        <ProductVariants
          variants={variantList}
          action={variantsAction}
        />
      )}

      {images.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong bg-surface-alt px-4 py-6 text-center text-sm text-muted">
          {text.empty}
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              aria-label={text.item(index + 1)}
              className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-start"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- our own image route */}
              <img
                src={image.src}
                alt={image.alt}
                className="size-24 shrink-0 rounded-md border border-line bg-surface-alt object-contain"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {image.id === mainId && <Badge>{text.main}</Badge>}
                {image.variant && (
                  <Badge variant="orange">
                    {text.variantBadge(nameFor(image.variant, variantList))}
                  </Badge>
                )}
                <DetailsForm
                  image={image}
                  position={index + 1}
                  variants={variants}
                  names={variantList}
                  action={altAction}
                />
                <div className="flex flex-wrap gap-2">
                  <form action={moveAction}>
                    <input type="hidden" name="id" value={image.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={index === 0}
                      aria-label={text.moveUp(index + 1)}
                      icon={<ArrowUp aria-hidden className="size-4" />}
                    />
                  </form>
                  <form action={moveAction}>
                    <input type="hidden" name="id" value={image.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={index === images.length - 1}
                      aria-label={text.moveDown(index + 1)}
                      icon={<ArrowDown aria-hidden className="size-4" />}
                    />
                  </form>
                  <ConfirmDelete
                    action={deleteAction}
                    id={image.id}
                    name={text.deleteName(index + 1)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {images.length < MAX_PRODUCT_IMAGES && (
        <UploadForm productId={productId} variants={variants} names={variantList} />
      )}
    </section>
  );
}

/** A variant's name; a key the product no longer has shows as stored. */
function nameFor(key: string, variants: BrandVariant[]) {
  return variants.find((variant) => variant.key === key)?.name ?? key;
}

/** The chip value for a general photo (variant keys never look like this). */
const GENERAL = "__general";

/**
 * "Shows for" as chips: general, or one Build Your Brand label variant. The
 * choice is sent as the hidden `variant` field ("" for a general photo).
 */
function VariantChips({
  label,
  names,
  defaultValue,
  error,
  help,
  className,
}: {
  label: string;
  names: BrandVariant[];
  defaultValue: string | null;
  error?: string;
  help?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <div className={className}>
      <ChoiceChips
        label={label}
        options={[
          { value: GENERAL, label: text.variantGeneral },
          ...names.map((variant) => ({ value: variant.key, label: variant.name })),
        ]}
        value={value || GENERAL}
        onValueChange={(next) => setValue(next === GENERAL ? "" : next)}
        error={error}
      />
      <input type="hidden" name="variant" value={value} />
      {help && <p className="mt-1.5 text-small text-muted">{help}</p>}
    </div>
  );
}

/** A photo's description and, for a Build Your Brand product, its variant. */
function DetailsForm({
  image,
  position,
  variants,
  names,
  action,
}: {
  image: ProductImageItem;
  position: number;
  variants: boolean;
  names: BrandVariant[];
  action: ProductImagesProps["altAction"];
}) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="id" value={image.id} />
      <Input
        name="alt"
        label={text.altFor(position)}
        defaultValue={image.alt}
        maxLength={200}
        error={state.fieldErrors?.alt}
        wrapperClassName="flex-1 sm:min-w-56"
      />
      {variants ? (
        <VariantChips
          label={text.variantFor(position)}
          names={names}
          defaultValue={image.variant}
          error={state.fieldErrors?.variant}
          className="w-full"
        />
      ) : (
        <input type="hidden" name="variant" value={image.variant ?? ""} />
      )}
      <Button type="submit" variant="secondary" size="sm" loading={pending} className="sm:mb-1">
        {text.saveAlt}
      </Button>
      {state.status === "success" && (
        <p role="status" className="text-small font-semibold text-success sm:mb-3">
          {state.message}
        </p>
      )}
    </form>
  );
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done" }
  | { status: "error"; message: string; field?: "file" | "alt" | "variant" };

function UploadForm({
  productId,
  variants,
  names,
}: {
  productId: number;
  variants: boolean;
  names: BrandVariant[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [uploads, setUploads] = useState(0);
  const fileIds = useFieldIds(undefined, {
    error: state.status === "error" && state.field === "file" ? state.message : undefined,
  });

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const alt = String(form.get("alt") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) {
      setState({ status: "error", message: text.errors.empty, field: "file" });
      return;
    }
    if (file.size > productImageUpload.maxBytes) {
      setState({ status: "error", message: text.errors.tooLarge(maxSize), field: "file" });
      return;
    }
    if (!alt) {
      setState({ status: "error", message: text.errors.alt, field: "alt" });
      return;
    }
    setState({ status: "uploading" });
    try {
      const response = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        body: form,
      });
      const reply = (await response.json()) as { ok: boolean; message?: string; error?: string };
      if (!reply.ok) {
        setState({
          status: "error",
          message: reply.message ?? text.errors.failed,
          field:
            reply.error === "alt" || reply.error === "variant"
              ? reply.error
              : reply.error === "notFound"
                ? undefined
                : "file",
        });
        return;
      }
      formRef.current?.reset();
      setUploads((count) => count + 1);
      setState({ status: "done" });
      router.refresh();
    } catch {
      setState({ status: "error", message: text.errors.failed });
    }
  }

  const fileError = state.status === "error" && state.field === "file" ? state.message : undefined;
  const altError = state.status === "error" && state.field === "alt" ? state.message : undefined;
  const variantError =
    state.status === "error" && state.field === "variant" ? state.message : undefined;

  return (
    <form
      ref={formRef}
      onSubmit={upload}
      noValidate
      className="mt-5 flex flex-col gap-4 border-t border-line pt-5"
    >
      {state.status === "error" && !state.field && (
        <FormAlert tone="error">{state.message}</FormAlert>
      )}
      {state.status === "done" && <FormAlert tone="success">{text.uploaded}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field ids={fileIds} label={text.file} error={fileError}>
          <input
            id={fileIds.inputId}
            type="file"
            name="file"
            accept={productImageUpload.accept}
            aria-invalid={fileError ? true : undefined}
            aria-describedby={fileIds.describedBy}
            className={cn(
              inputClasses,
              "cursor-pointer py-2.5 file:mr-3 file:rounded-sm file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:font-bold file:text-brand",
            )}
          />
        </Field>
        <Input
          name="alt"
          label={text.alt}
          help={text.altHelp}
          maxLength={200}
          error={altError}
        />
        {variants && (
          <VariantChips
            // A new key after each upload puts the choice back to general,
            // like the form reset does for the other fields.
            key={uploads}
            label={text.variant}
            names={names}
            defaultValue={null}
            help={text.variantHelp}
            error={variantError}
            className="sm:col-span-2"
          />
        )}
      </div>
      <div>
        <Button
          type="submit"
          variant="secondary"
          loading={state.status === "uploading"}
          icon={<Upload aria-hidden className="size-4" />}
        >
          {state.status === "uploading" ? text.uploading : text.upload}
        </Button>
      </div>
    </form>
  );
}
