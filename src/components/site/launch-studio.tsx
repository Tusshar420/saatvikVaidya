"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import {
  addToBrandCartAction,
  setBrandCartQuantityAction,
} from "@/app/(site)/launch/actions";
import { Button } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { LaunchPreview } from "@/server/content/home-live";

const text = copy.launch;

/**
 * v2 "Live product preview" (`.product-studio`): a real Build Your Brand
 * product, its MOQ steps and the net rate each reaches. "Add to Order" puts
 * that quantity in the Launch cart (signed-out visitors are sent to sign in).
 */
export function LaunchStudio({ product }: { product: LaunchPreview }) {
  const [quantity, setQuantity] = useState(product.options[0]?.quantity ?? product.minQty);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const option = product.options.find((o) => o.quantity === quantity) ?? product.options[0];
  const unit = product.unitLabel;

  const add = () =>
    startTransition(async () => {
      const added = await addToBrandCartAction({ productId: product.productId });
      if (!added.ok) return setResult({ ok: false, message: added.message });
      if (quantity !== product.minQty) {
        const set = await setBrandCartQuantityAction({ productId: product.productId, quantity });
        if (!set.ok) return setResult({ ok: false, message: set.message });
      }
      setResult({ ok: true });
    });

  return (
    <div className="reveal rounded-[21px] border border-brand/14 bg-surface p-4.25 shadow-raised sm:rounded-2xl sm:p-6.25 md:max-w-162.5 lg:max-w-none">
      <div className="flex items-center justify-between border-b border-line pb-4.5">
        <div className="flex flex-col">
          <span className="font-heading text-[11px] font-extrabold tracking-[0.12em] text-orange-ink uppercase">
            {text.previewKicker}
          </span>
          <span className="mt-1 font-heading text-lg font-extrabold">{product.name}</span>
        </div>
        <span className="flex items-center gap-1.25 rounded-sm bg-success-soft px-2.25 py-1.75 text-[11px] font-extrabold text-brand">
          <ShieldCheck aria-hidden className="size-3.5" />
          {text.gmp}
        </span>
      </div>

      <div className="grid grid-cols-[130px_1fr] items-center gap-3.25 py-7 sm:grid-cols-[190px_1fr] sm:gap-6.75 sm:px-1.5">
        <div aria-hidden className="relative mx-auto h-37.5 w-25.5 rounded-[20px_20px_25px_25px] bg-linear-90 from-surface-alt via-surface to-surface-alt shadow-card sm:h-46.25 sm:w-32.5">
          <span className="absolute -top-4 left-3 h-6 w-19.5 rounded-[9px_9px_5px_5px] bg-cta sm:left-3.75 sm:h-7.25 sm:w-24.75" />
          <span className="absolute inset-x-2.5 top-9 bottom-5 flex flex-col items-center rounded-[11px] border-2 border-surface bg-linear-160 from-gold-soft to-gold px-1.75 py-2.75 text-center text-gold-ink sm:top-11.25 sm:px-2.5 sm:py-3.75">
            <span className="text-[7px] tracking-[0.12em] uppercase">{text.yourLogo}</span>
            <span className="my-auto font-heading text-xs leading-[1.05] font-extrabold sm:text-base">
              {product.name}
            </span>
            <span className="text-[8px]">{product.packSize}</span>
          </span>
        </div>
        <div>
          <span className="font-heading text-[11px] font-extrabold tracking-[0.12em] text-orange-ink uppercase">
            {product.formName}
            {product.makerName ? ` • ${product.makerName}` : ""}
          </span>
          <p className="my-2.25 font-heading text-[23px] leading-[1.05] font-extrabold tracking-[-0.04em] sm:text-[29px]">
            {text.infoTitle}
            <br />
            {text.infoEmphasis}
          </p>
          <p className="m-0 text-xs leading-[1.55] text-muted sm:text-[13px]">{text.infoBody}</p>
          <Link href="/launch" className="mt-2 inline-flex min-h-11 items-center text-xs font-extrabold text-brand hover:underline">
            {text.labelsLink}
          </Link>
        </div>
      </div>

      <div className="rounded-[17px] border border-line p-3.25 sm:p-4.5">
        <div className="mb-2.75 flex justify-between gap-2">
          <span id="studio-qty" className="text-xs font-extrabold">{text.quantity}</span>
          <span className="text-[11px] text-muted">{text.moqFrom(product.minQty)}</span>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="studio-qty"
          className="grid grid-cols-5 gap-1 sm:gap-1.75"
        >
          {product.options.map((o) => (
            <button
              key={o.quantity}
              type="button"
              role="radio"
              aria-checked={o.quantity === quantity}
              onClick={() => {
                setQuantity(o.quantity);
                setResult(null);
              }}
              className={cn(
                "h-11 rounded-[9px] border text-xs font-extrabold transition",
                o.quantity === quantity
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink hover:border-brand",
              )}
            >
              {o.quantity}
            </button>
          ))}
        </div>
        <dl className="mt-3.75 grid grid-cols-2 gap-1.75 sm:gap-3">
          <div className="flex flex-col rounded-[11px] bg-surface-alt p-2.5 sm:p-3">
            <dt className="text-[11px] text-muted">{text.mrp}</dt>
            <dd className="m-0 mt-0.75 font-heading text-[15px] font-extrabold sm:text-lg">
              {formatPaise(product.mrpPaise)}
            </dd>
          </div>
          <div className="flex flex-col rounded-[11px] bg-surface-alt p-2.5 sm:p-3">
            <dt className="text-[11px] text-muted">{text.netRate}</dt>
            <dd className="m-0 mt-0.75 font-heading text-[15px] font-extrabold sm:text-lg" aria-live="polite">
              {formatPaise(option?.unitPaise ?? 0)}{" "}
              <span className="font-body text-[11px] font-medium text-muted">{text.perUnit}</span>
            </dd>
          </div>
        </dl>
        <div className="mt-3.5 flex items-end justify-between gap-3 sm:items-center">
          <span className="flex flex-col">
            <b className="text-small">{text.units(quantity, unit)}</b>
            <small className="mt-0.75 max-w-30 text-[11px] text-muted sm:max-w-none">{text.noPayment}</small>
          </span>
          <Button size="sm" loading={pending} onClick={add} className="px-3 sm:px-3.75">
            {text.add}
          </Button>
        </div>
        <div aria-live="polite" className="text-small">
          {result?.ok && (
            <p className="mt-2 mb-0 font-bold text-brand">
              {text.added}{" "}
              <Link href="/launch?step=2" className="underline underline-offset-4">
                {text.viewOrder}
              </Link>
            </p>
          )}
          {result && !result.ok && <p className="mt-2 mb-0 font-medium text-danger">{result.message}</p>}
        </div>
      </div>
      <p className="mx-0.5 mt-2.25 mb-0 text-[11px] text-muted">{text.footnote}</p>
    </div>
  );
}
