"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { admin as copy } from "@/content/admin";
import {
  defaultPhotoAlt,
  rowsOverLimit,
  searchPhotoProducts,
  type PhotoProduct,
} from "@/lib/bulk-photos";
import { MAX_PRODUCT_IMAGES, productImageUpload } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/verification";

const text = copy.catalogue.bulkPhotos;
const imageErrors = copy.catalogue.images.errors;
const maxSize = formatFileSize(productImageUpload.maxBytes);

/** The chip value for a general photo (variant keys never look like this). */
const GENERAL = "__general";

type RowField = "product" | "variant" | "file" | "alt";
type RowStatus = "ready" | "uploading" | "done" | "error";

type Row = {
  id: string;
  productId: number | null;
  /** "" for a general photo, else a variant key of the product. */
  variant: string;
  file: File | null;
  /** An object URL for the thumbnail. */
  preview: string | null;
  alt: string;
  status: RowStatus;
  message?: string;
  field?: RowField;
};

const statusBadge: Record<RowStatus, BadgeVariant> = {
  ready: "brand",
  uploading: "blue",
  done: "success",
  error: "live",
};

/**
 * Many product photos at once: one row per photo with the medicine (a
 * searchable list), its label variant and the image. Upload sends the rows
 * one by one to the same route as the product page's single upload, so each
 * photo gets the same checks; rows that fail stay to be fixed and retried.
 */
export function BulkPhotoUpload({
  products: initialProducts,
  initialProductId,
}: {
  products: PhotoProduct[];
  initialProductId?: number;
}) {
  const nextId = useRef(0);
  const newId = () => `row-${++nextId.current}`;
  const [products, setProducts] = useState(initialProducts);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const start =
    initialProductId !== undefined && byId.has(initialProductId) ? initialProductId : null;
  const [rows, setRows] = useState<Row[]>(() => [blankRow("row-0", start)]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ done: number; failed: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const many = useRef<HTMLInputElement>(null);

  // Free the thumbnails when the page is left.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const previewOf = (file: File) => {
    const url = URL.createObjectURL(file);
    previews.current.add(url);
    return url;
  };
  const dropPreview = (url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previews.current.delete(url);
  };

  const pending = rows.filter((row) => row.status !== "done");
  const over = rowsOverLimit(pending, products);

  function update(id: string, change: Partial<Row>) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...change,
              // An edit clears the row's last error.
              ...(change.status ? {} : { status: "ready" as const, message: undefined, field: undefined }),
            }
          : row,
      ),
    );
    setSummary(null);
    setFormError(null);
  }

  /** The variant after `key` in the product's list (for the next row). */
  function nextVariant(productId: number | null, key: string) {
    const variants = productId === null ? [] : (byId.get(productId)?.variants ?? []);
    if (!key || variants.length === 0) return "";
    const index = variants.findIndex((variant) => variant.key === key);
    return variants[(index + 1) % variants.length]?.key ?? "";
  }

  function addRow() {
    const last = rows.at(-1);
    const productId = last?.productId ?? null;
    setRows((current) => [
      ...current,
      { ...blankRow(newId(), productId), variant: nextVariant(productId, last?.variant ?? "") },
    ]);
    setSummary(null);
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files];
    setRows((current) => {
      const last = current.at(-1);
      const productId = last?.productId ?? null;
      // Fill an empty last row first, then add one row per file.
      const reuse = last && !last.file && last.status !== "done" ? last : null;
      const base = reuse ? current.slice(0, -1) : current;
      let variant = reuse ? reuse.variant : nextVariant(productId, last?.variant ?? "");
      const added = list.map((file, index) => {
        if (index > 0) variant = nextVariant(productId, variant);
        const row: Row = {
          ...(index === 0 && reuse ? reuse : blankRow(newId(), productId)),
          variant,
          file,
          preview: previewOf(file),
          status: "ready",
          message: undefined,
          field: undefined,
        };
        return row;
      });
      return [...base, ...added];
    });
    setSummary(null);
    setFormError(null);
    if (many.current) many.current.value = "";
  }

  function removeRow(id: string) {
    const row = rows.find((r) => r.id === id);
    dropPreview(row?.preview ?? null);
    setRows((current) => {
      const left = current.filter((r) => r.id !== id);
      return left.length > 0 ? left : [blankRow(newId(), null)];
    });
  }

  function clearDone() {
    rows.filter((row) => row.status === "done").forEach((row) => dropPreview(row.preview));
    setRows((current) => {
      const left = current.filter((row) => row.status !== "done");
      return left.length > 0 ? left : [blankRow(newId(), current.at(-1)?.productId ?? null)];
    });
    setSummary(null);
  }

  /** A row's problem before sending it, if any. */
  function check(row: Row): Pick<Row, "message" | "field"> | null {
    if (row.productId === null || !byId.has(row.productId)) {
      return { field: "product", message: text.errors.product };
    }
    if (!row.file || row.file.size === 0) return { field: "file", message: text.errors.file };
    if (row.file.size > productImageUpload.maxBytes) {
      return { field: "file", message: imageErrors.tooLarge(maxSize) };
    }
    if (row.file.type && !(row.file.type in productImageUpload.types)) {
      return { field: "file", message: imageErrors.fileType };
    }
    if (over.has(row.id)) return { field: "product", message: text.errors.full(MAX_PRODUCT_IMAGES) };
    return null;
  }

  async function uploadAll() {
    // A row with nothing chosen at all is ignored (unless it's the only one).
    const queue = pending.filter((row) => row.productId !== null || row.file !== null);
    if (queue.length === 0) {
      setFormError(text.errors.nothing);
      return;
    }
    const problems = new Map(queue.map((row) => [row.id, check(row)] as const));
    if ([...problems.values()].some(Boolean)) {
      setRows((current) =>
        current.map((row) => {
          const problem = problems.get(row.id);
          return problem ? { ...row, status: "error", ...problem } : row;
        }),
      );
      return;
    }

    setBusy(true);
    setSummary(null);
    setFormError(null);
    let done = 0;
    let failed = 0;
    setProgress({ done: 0, total: queue.length });
    for (const row of queue) {
      const product = byId.get(row.productId!)!;
      const variantName = product.variants.find((v) => v.key === row.variant)?.name ?? null;
      update(row.id, { status: "uploading" });
      const form = new FormData();
      form.set("file", row.file!);
      form.set("alt", row.alt.trim() || defaultPhotoAlt(product.name, variantName));
      form.set("variant", row.variant);
      let result: Partial<Row>;
      try {
        const response = await fetch(`/api/admin/products/${product.id}/images`, {
          method: "POST",
          body: form,
        });
        const reply = (await response.json()) as { ok: boolean; message?: string; error?: string };
        if (reply.ok) {
          result = { status: "done" };
          done += 1;
          setProducts((current) =>
            current.map((p) => (p.id === product.id ? { ...p, imageCount: p.imageCount + 1 } : p)),
          );
        } else {
          failed += 1;
          result = {
            status: "error",
            message: reply.message ?? imageErrors.failed,
            field:
              reply.error === "alt"
                ? "alt"
                : reply.error === "variant"
                  ? "variant"
                  : reply.error === "notFound" || reply.error === "tooMany"
                    ? "product"
                    : "file",
          };
        }
      } catch {
        failed += 1;
        result = { status: "error", message: imageErrors.failed, field: "file" };
      }
      update(row.id, result);
      setProgress({ done: done + failed, total: queue.length });
    }
    setBusy(false);
    setProgress(null);
    setSummary({ done, failed });
  }

  const ready = pending.filter((row) => row.productId !== null && row.file !== null).length;
  const hasDone = rows.some((row) => row.status === "done");

  return (
    <section
      aria-label={text.rowsLabel}
      className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6"
    >
      {formError && <FormAlert className="mb-4">{formError}</FormAlert>}
      {summary && (
        <FormAlert tone={summary.failed > 0 ? "error" : "success"} className="mb-4">
          {text.summary(summary.done, summary.failed)}
        </FormAlert>
      )}

      <ol className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <PhotoRow
            key={row.id}
            row={row}
            position={index + 1}
            products={products}
            product={row.productId === null ? undefined : byId.get(row.productId)}
            disabled={busy || row.status === "done"}
            busy={busy}
            onChange={(change) => update(row.id, change)}
            onFile={(file) => {
              dropPreview(row.preview);
              update(row.id, { file, preview: file ? previewOf(file) : null });
            }}
            onRemove={() => removeRow(row.id)}
          />
        ))}
      </ol>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="secondary"
          onClick={addRow}
          disabled={busy}
          icon={<Plus aria-hidden className="size-4" />}
        >
          {text.addRow}
        </Button>
        <label
          className={cn(
            buttonClasses({ variant: "secondary" }),
            "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <ImagePlus aria-hidden className="size-4" />
          {text.addMany}
          <input
            ref={many}
            type="file"
            multiple
            accept={productImageUpload.accept}
            disabled={busy}
            onChange={(event) => addFiles(event.target.files)}
            className="sr-only"
          />
        </label>
        {hasDone && !busy && (
          <Button type="button" variant="link" onClick={clearDone}>
            {text.clearDone}
          </Button>
        )}
        <Button
          type="button"
          onClick={uploadAll}
          loading={busy}
          className="sm:ml-auto"
          icon={<Upload aria-hidden className="size-4" />}
        >
          {progress
            ? text.uploading(progress.done, progress.total)
            : ready > 0
              ? text.upload(ready)
              : text.uploadNone}
        </Button>
      </div>
      <p className="mt-2 text-small text-muted">{text.addManyHelp}</p>
    </section>
  );
}

function blankRow(id: string, productId: number | null): Row {
  return { id, productId, variant: "", file: null, preview: null, alt: "", status: "ready" };
}

function PhotoRow({
  row,
  position,
  products,
  product,
  disabled,
  busy,
  onChange,
  onFile,
  onRemove,
}: {
  row: Row;
  position: number;
  products: PhotoProduct[];
  product: PhotoProduct | undefined;
  disabled: boolean;
  busy: boolean;
  onChange: (change: Partial<Row>) => void;
  onFile: (file: File | null) => void;
  onRemove: () => void;
}) {
  const error = (field: RowField) =>
    row.status === "error" && row.field === field ? row.message : undefined;
  const fileIds = useFieldIds(undefined, { error: error("file") });
  const variantHelp = !product
    ? text.variantPick
    : product.variants.length === 0
      ? text.variantNone
      : undefined;

  return (
    <li
      aria-label={text.row(position)}
      className={cn(
        "rounded-lg border p-3 sm:p-4",
        row.status === "error" ? "border-danger" : "border-line",
        row.status === "done" && "bg-surface-alt",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <p className="text-sm font-extrabold text-ink">{text.row(position)}</p>
        <Badge variant={statusBadge[row.status]}>{text.status[row.status]}</Badge>
        {row.status === "done" && product && (
          <Link
            href={`/admin/catalogue/${product.id}/edit#images`}
            className="text-small font-bold text-brand hover:underline"
          >
            {text.openProduct}
          </Link>
        )}
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onRemove}
          disabled={busy}
          aria-label={text.remove(position)}
          className="ml-auto text-danger"
          icon={<Trash2 aria-hidden className="size-4" />}
        />
      </div>
      {row.status === "error" && row.message && !row.field && (
        <FormAlert className="mb-3">{row.message}</FormAlert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <ProductPicker
          label={text.product(position)}
          products={products}
          selected={product}
          disabled={disabled}
          error={error("product")}
          onSelect={(picked) =>
            onChange({
              productId: picked.id,
              variant: picked.variants.some((v) => v.key === row.variant) ? row.variant : "",
            })
          }
        />
        <Field ids={fileIds} label={text.file(position)} error={error("file")}>
          <div className="flex items-center gap-3">
            {row.preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL)
              <img
                src={row.preview}
                alt=""
                className="size-12 shrink-0 rounded-md border border-line bg-surface-alt object-contain"
              />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-md border border-dashed border-line-strong bg-surface-alt text-muted">
                <ImagePlus aria-hidden className="size-5" />
              </span>
            )}
            <input
              id={fileIds.inputId}
              type="file"
              accept={productImageUpload.accept}
              disabled={disabled}
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
              aria-invalid={error("file") ? true : undefined}
              aria-describedby={fileIds.describedBy}
              className={cn(
                inputClasses,
                "cursor-pointer py-2.5 text-small file:mr-3 file:rounded-sm file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:font-bold file:text-brand",
                // A file added with "Add several images" isn't in this input.
                row.file && "text-transparent",
              )}
            />
          </div>
          {row.file && (
            <p className="mt-1.5 truncate text-small text-muted" title={row.file.name}>
              {row.file.name} · {formatFileSize(row.file.size)}
            </p>
          )}
        </Field>
        <div className="md:col-span-2">
          <ChoiceChips
            label={text.variant(position)}
            options={[
              { value: GENERAL, label: text.variantGeneral },
              ...(product?.variants ?? []).map((variant) => ({
                value: variant.key,
                label: variant.name,
              })),
            ]}
            value={row.variant || GENERAL}
            onValueChange={(value) => onChange({ variant: value === GENERAL ? "" : value })}
            disabled={disabled || !product || product.variants.length === 0}
            error={error("variant")}
          />
          {variantHelp && <p className="mt-1.5 text-small text-muted">{variantHelp}</p>}
        </div>
        <Input
          label={text.alt(position)}
          optional
          value={row.alt}
          maxLength={200}
          placeholder={text.altPlaceholder}
          disabled={disabled}
          error={error("alt")}
          onChange={(event) => onChange({ alt: event.target.value })}
          wrapperClassName="md:col-span-2"
        />
      </div>
    </li>
  );
}

/** A searchable list of medicines (an ARIA combobox). */
function ProductPicker({
  label,
  products,
  selected,
  disabled,
  error,
  onSelect,
}: {
  label: string;
  products: PhotoProduct[];
  selected: PhotoProduct | undefined;
  disabled: boolean;
  error?: string;
  onSelect: (product: PhotoProduct) => void;
}) {
  const ids = useFieldIds(undefined, {
    error,
    help: selected ? describe(selected) : undefined,
  });
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(
    () => searchPhotoProducts(query ?? "", products),
    [query, products],
  );
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(product: PhotoProduct) {
    onSelect(product);
    setQuery(null);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const product = results[active];
      if (product) choose(product);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery(null);
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;
  const showList = open && !disabled;

  return (
    <Field ids={ids} label={label} error={error} help={selected ? describe(selected) : undefined}>
      <div className="relative">
        <input
          id={ids.inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results.length > 0 ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={text.productPlaceholder}
          value={query ?? selected?.name ?? ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={(event) => {
            event.currentTarget.select();
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery(null);
          }}
          onKeyDown={onKeyDown}
          className={inputClasses}
        />
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!showList}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-card"
        >
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-3 text-small text-muted">
              {text.productNone}
            </li>
          ) : (
            results.map((product, index) => (
              <li
                key={product.id}
                id={optionId(index)}
                data-index={index}
                role="option"
                aria-selected={index === active}
                // Keep focus in the input so the click lands before blur.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(product)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "cursor-pointer rounded-sm px-3 py-2",
                  index === active ? "bg-brand-soft" : "hover:bg-surface-alt",
                )}
              >
                <span className="block text-sm font-bold text-ink">{product.name}</span>
                <span className="block text-small text-muted">{describe(product)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </Field>
  );
}

/** "Brand · pack · 2 of 8 photos · Build Your Brand · Hidden". */
function describe(product: PhotoProduct) {
  return [
    product.brand,
    product.packSize,
    text.productPhotos(product.imageCount, MAX_PRODUCT_IMAGES),
    product.brandEligible ? text.brandProduct : null,
    product.active ? null : text.productHidden,
  ]
    .filter(Boolean)
    .join(" · ");
}
