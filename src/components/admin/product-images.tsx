"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Upload } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { admin as copy } from "@/content/admin";
import { MAX_PRODUCT_IMAGES, productImageUpload } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/verification";
import { idleForm, type FormState } from "@/server/admin/form";
import { ConfirmDelete } from "./confirm-delete";

const text = copy.catalogue.images;
const maxSize = formatFileSize(productImageUpload.maxBytes);

export type ProductImageItem = { id: number; src: string; alt: string };

export type ProductImagesProps = {
  productId: number;
  images: ProductImageItem[];
  moveAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  altAction: (state: FormState, formData: FormData) => Promise<FormState>;
};

/** A product's photos: upload, put in order, describe and delete. */
export function ProductImages({
  productId,
  images,
  moveAction,
  deleteAction,
  altAction,
}: ProductImagesProps) {
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
                {index === 0 && <Badge>{text.main}</Badge>}
                <AltForm image={image} position={index + 1} action={altAction} />
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

      {images.length < MAX_PRODUCT_IMAGES && <UploadForm productId={productId} />}
    </section>
  );
}

function AltForm({
  image,
  position,
  action,
}: {
  image: ProductImageItem;
  position: number;
  action: ProductImagesProps["altAction"];
}) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="id" value={image.id} />
      <Input
        name="alt"
        label={text.altFor(position)}
        defaultValue={image.alt}
        maxLength={200}
        error={state.fieldErrors?.alt}
        wrapperClassName="flex-1"
      />
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
  | { status: "error"; message: string; field?: "file" | "alt" };

function UploadForm({ productId }: { productId: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
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
          field: reply.error === "alt" ? "alt" : reply.error === "notFound" ? undefined : "file",
        });
        return;
      }
      formRef.current?.reset();
      setState({ status: "done" });
      router.refresh();
    } catch {
      setState({ status: "error", message: text.errors.failed });
    }
  }

  const fileError = state.status === "error" && state.field === "file" ? state.message : undefined;
  const altError = state.status === "error" && state.field === "alt" ? state.message : undefined;

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
