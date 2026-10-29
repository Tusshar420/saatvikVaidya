import { ShieldCheck } from "lucide-react";
import { brand } from "@/content/brand";
import { cn } from "@/lib/cn";

const copy = brand.launch.preview;

export type LabelPreviewProps = {
  brandName: string | null;
  tagline: string | null;
  marketedBy: string | null;
  /** An image logo's URL (PDF logos aren't drawn on the pack). */
  logoSrc: string | null;
  product: { name: string; packSize: string } | null;
  productCount: number;
  className?: string;
};

/**
 * The v2 "Live label preview" card (`.preview-card`) on the packaging step:
 * a pack with the chosen brand's logo, name and Marketed By line on the
 * first product in the launch cart. It follows the saved brand.
 */
export function LabelPreview({
  brandName,
  tagline,
  marketedBy,
  logoSrc,
  product,
  productCount,
  className,
}: LabelPreviewProps) {
  return (
    <aside
      aria-label={copy.labelTitle}
      className={cn(
        "rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-[15px] font-extrabold text-ink">
          {copy.labelTitle}
        </h3>
        <span className="inline-flex items-center gap-1.25 rounded-sm bg-success-soft px-2.5 py-1.5 text-[11px] font-extrabold text-success">
          <ShieldCheck aria-hidden className="size-3.5" />
          {copy.badge}
        </span>
      </div>
      <div className="grid grid-cols-[120px_1fr] items-center gap-4.5 py-8 sm:grid-cols-[150px_1fr]">
        <div
          aria-hidden
          className="relative mx-auto h-41.25 w-28.75 rounded-t-[18px] rounded-b-[23px] border border-line bg-surface-alt shadow-card"
        >
          <div className="absolute inset-x-3.25 -top-3.25 h-6.5 rounded-sm bg-brand-mark" />
          <div className="absolute inset-x-2.25 top-10 bottom-4.5 flex flex-col justify-center overflow-hidden rounded-[10px] border-2 border-white px-1.75 py-2.5 text-center text-gold-ink bg-quiz">
            {logoSrc ? (
              // Plain <img>: a private route serves it; decorative here (the logo is shown with its alt text in the form).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="mx-auto mb-0.75 h-5 w-8.5 object-contain"
              />
            ) : (
              <small className="truncate text-[7px] font-bold tracking-[0.08em] uppercase">
                {brandName ?? copy.yourBrand}
              </small>
            )}
            <b className="my-2 font-heading text-[13px] leading-[1.05] font-extrabold break-words">
              {product?.name ?? brandName ?? copy.yourBrand}
            </b>
            {product && (
              <small className="text-[7px]">{product.packSize}</small>
            )}
            <small className="mt-1 truncate text-[6px]">
              {copy.marketedBy(marketedBy ?? brandName ?? copy.yourBrand)}
            </small>
          </div>
        </div>
        <dl className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-col">
            <dt className="text-[11px] text-muted">{copy.brand}</dt>
            <dd className="text-sm font-bold break-words text-ink">
              {brandName ?? "—"}
            </dd>
          </div>
          {tagline && (
            <div className="flex flex-col">
              <dt className="sr-only">{brand.detail.tagline}</dt>
              <dd className="text-small break-words text-muted">{tagline}</dd>
            </div>
          )}
          <div className="flex flex-col">
            <dt className="text-[11px] text-muted">{copy.product}</dt>
            <dd className="text-sm font-bold break-words text-ink">
              {product?.name ?? "—"}
              {productCount > 1 && (
                <span className="block text-small font-medium text-muted">
                  {copy.products(productCount)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
      <p className="rounded-sm bg-success-soft p-2.5 text-xs leading-normal text-success">
        {copy.labelNote}
      </p>
    </aside>
  );
}
