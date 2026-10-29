"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import {
  confirmBrandDetailsAction,
  saveBrandDetailsAction,
} from "@/app/(site)/launch/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand as copy } from "@/content/brand";
import { brandLogoUpload, isImageLogo, packagingLimits } from "@/lib/brand";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LabelPreview } from "./label-preview";
import { uploadBrandLogo } from "./upload-logo";

const text = copy.brandStep;

export type BrandStepLine = {
  productId: number;
  name: string;
  /** The product's net rate before bulk tiers, in paise (the least an MRP may be). */
  unitPricePaise: number;
  /** MRP saved earlier, in whole rupees. */
  mrp: number | null;
};

/**
 * Step 2 of Build Your Brand: the quantities (drawn by the page, as
 * `quantity`) and the brand details form (brand name, MRP per product,
 * marketed-by address, logo) beside a live label preview and the total. One
 * button saves the brand, uploads the logo, saves the MRPs and goes on to
 * delivery and payment; the server checks everything again.
 */
export function BrandStep({
  quantity,
  summary,
  lines,
  ready,
  profile,
  preview,
}: {
  quantity: ReactNode;
  summary: ReactNode;
  lines: BrandStepLine[];
  /** Every product has an allowed quantity. */
  ready: boolean;
  profile: {
    brandName: string;
    marketedByAddress: string;
    /** The saved logo, when there is one. */
    logo: { src: string; contentType: string } | null;
  } | null;
  /** The first product, for the label preview. */
  preview: { name: string; packSize: string } | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const formId = useId();
  const [brandName, setBrandName] = useState(profile?.brandName ?? "");
  const [address, setAddress] = useState(profile?.marketedByAddress ?? "");
  const [mrps, setMrps] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [String(line.productId), line.mrp ? String(line.mrp) : ""])),
  );
  const [file, setFile] = useState<File | null>(null);
  // The file already stored for this brand (a failed later step must not upload it again).
  const [uploaded, setUploaded] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // A newly chosen image is previewed from the device; its object URL is let go of when replaced or on leaving.
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);
  function choose(next: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next && isImageLogo(next.type) ? URL.createObjectURL(next) : null;
    setFileUrl(urlRef.current);
    setFile(next);
  }

  const hasLogo = file !== null || profile?.logo != null;
  const logoSrc = fileUrl ?? (profile?.logo && isImageLogo(profile.logo.contentType) ? profile.logo.src : null);
  const complete =
    ready &&
    brandName.trim() !== "" &&
    address.trim() !== "" &&
    lines.every((line) => /^\d+$/.test((mrps[String(line.productId)] ?? "").trim()));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found: Record<string, string> = {};
    if (!brandName.trim()) found.brandName = text.errors.brandName;
    if (!address.trim()) found.marketedByAddress = text.errors.address;
    for (const line of lines) {
      if (!/^\d+$/.test((mrps[String(line.productId)] ?? "").trim())) found[`mrp-${line.productId}`] = text.errors.mrp.missing;
    }
    if (!hasLogo) found.logo = text.logoRequired;
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length > 0) {
      setMessage(copy.packaging.errors.form);
      return;
    }
    setPending(true);
    try {
      const saved = await saveBrandDetailsAction({ brandName, marketedByAddress: address });
      if (!saved.ok) {
        setErrors(saved.fieldErrors ?? {});
        setMessage(saved.message);
        return;
      }
      if (file && file !== uploaded) {
        const problem = await uploadBrandLogo(saved.profileId, file);
        if (problem) {
          setErrors({ logo: problem });
          setMessage(problem);
          return;
        }
        setUploaded(file);
      }
      const done = await confirmBrandDetailsAction(mrps);
      if (!done.ok) {
        setErrors(done.fieldErrors ?? {});
        setMessage(done.message);
        return;
      }
      router.push("/launch?step=3");
    } catch {
      setMessage(text.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-5.5">
      <div className="flex min-w-0 flex-col gap-5">
        {quantity}
        <form
          id={formId}
          onSubmit={submit}
          noValidate
          aria-labelledby={`${formId}-title`}
          className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
        >
          <h3 id={`${formId}-title`} className="text-h3 text-ink">
            {text.detailsTitle}
          </h3>
          {message && <FormAlert>{message}</FormAlert>}
          <Input
            label={<>{text.brandName} <span className="text-danger">*</span></>}
            name="brandName"
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            placeholder={text.brandNamePlaceholder}
            maxLength={packagingLimits.brandName}
            autoComplete="organization"
            error={errors.brandName}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-xs font-extrabold text-ink">
              {text.mrpTitle} <span className="text-danger">*</span>
            </legend>
            {lines.map((line) => (
              <div key={line.productId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={`${formId}-mrp-${line.productId}`} className="min-w-0 text-sm text-ink">
                    <span className="sr-only">{text.mrpLabel(line.name)}</span>
                    <span aria-hidden>{line.name}</span>
                  </label>
                  <span className="flex h-12 w-36 shrink-0 items-center overflow-hidden rounded-md border border-line bg-surface-alt focus-within:border-brand has-[[aria-invalid=true]]:border-danger">
                    <span aria-hidden className="grid h-full w-9 place-items-center border-r border-line font-bold text-ink">₹</span>
                    <input
                      id={`${formId}-mrp-${line.productId}`}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={mrps[String(line.productId)] ?? ""}
                      onChange={(event) =>
                        setMrps({ ...mrps, [String(line.productId)]: event.target.value.replace(/\D/g, "").slice(0, 7) })
                      }
                      aria-invalid={errors[`mrp-${line.productId}`] ? true : undefined}
                      aria-describedby={`${formId}-mrp-help-${line.productId}`}
                      className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none"
                    />
                  </span>
                </div>
                <p
                  id={`${formId}-mrp-help-${line.productId}`}
                  className={cn("text-small", errors[`mrp-${line.productId}`] ? "font-medium text-danger" : "text-muted")}
                >
                  {errors[`mrp-${line.productId}`] ?? text.mrpHelp(formatPaise(line.unitPricePaise))}
                </p>
              </div>
            ))}
          </fieldset>
          <div className="flex flex-col">
            <label htmlFor={`${formId}-address`} className="mb-1.5 block text-xs font-extrabold text-ink">
              {text.address} <span className="text-danger">*</span>
            </label>
            <textarea
              id={`${formId}-address`}
              name="marketedByAddress"
              rows={3}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={text.addressPlaceholder}
              maxLength={packagingLimits.marketedByAddress}
              aria-invalid={errors.marketedByAddress ? true : undefined}
              aria-describedby={errors.marketedByAddress ? `${formId}-address-error` : undefined}
              className="min-h-24 w-full rounded-md border border-line bg-surface-alt px-3.5 py-3 text-base text-ink transition placeholder:text-muted focus:border-brand focus:bg-surface aria-invalid:border-danger"
            />
            {errors.marketedByAddress && (
              <p id={`${formId}-address-error`} className="mt-1.5 text-small font-medium text-danger">
                {errors.marketedByAddress}
              </p>
            )}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-xs font-extrabold text-ink">
              {text.logo} <span className="text-danger">*</span>
            </legend>
            <div className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden
                className="grid size-18 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-line-strong bg-surface-alt text-xs text-muted"
              >
                {logoSrc ? (
                  // Plain <img>: a local preview or a private route serves it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt="" className="size-full object-contain" />
                ) : (
                  text.logoPlaceholder
                )}
              </span>
              <input
                ref={input}
                id={`${formId}-logo`}
                type="file"
                accept={brandLogoUpload.accept}
                className="sr-only"
                aria-label={text.logo}
                onChange={(event) => choose(event.target.files?.[0] ?? null)}
              />
              <Button
                variant="secondary"
                icon={<Upload aria-hidden className="size-4" />}
                onClick={() => input.current?.click()}
              >
                {hasLogo ? text.replaceLogo : text.upload}
              </Button>
              <span className="min-w-0 text-small break-words text-muted">
                {file ? file.name : profile?.logo ? copy.packaging.logo.uploaded : text.logoHelp}
              </span>
            </div>
            {errors.logo && <p className="text-small font-medium text-danger">{errors.logo}</p>}
          </fieldset>
        </form>
        <div>
          <Button type="submit" form={formId} size="lg" loading={pending} disabled={!complete || pending} arrow className="w-full">
            {pending ? text.saving : text.continue}
          </Button>
          {!complete && <p className="mt-2.5 text-center text-small text-muted">{text.hint}</p>}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-40">
        <LabelPreview
          brandName={brandName.trim() || null}
          tagline={null}
          marketedBy={brandName.trim() || null}
          logoSrc={logoSrc}
          product={preview}
          productCount={lines.length}
        />
        {summary}
      </div>
    </div>
  );
}
