"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, Download } from "lucide-react";
import { addEbookToCartAction, type CartActionResult } from "@/app/(site)/cart/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { PausedNote } from "./paused-note";
import { ebooks as copy } from "@/content/ebooks";
import { signInPath } from "@/lib/auth-routes";
import { cn } from "@/lib/cn";
import { ebookDownloadHref, ebookHref } from "@/lib/ebooks";
import type { EbookAccess } from "@/server/ebooks/ebooks";

const text = copy.actions;

export type EbookActionProps = {
  ebookId: number;
  slug: string;
  title: string;
  access: EbookAccess;
  /** Downloads are paused for everyone; shown as a note even to non-buyers. */
  paused: boolean;
  className?: string;
};

/**
 * What a reader can do with a book: download it, sign in, add it to the
 * cart, or see that downloads are paused. The server checks again on every
 * download and cart change.
 */
export function EbookAction({ ebookId, slug, title, access, paused, className }: EbookActionProps) {
  const [result, setResult] = useState<CartActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const full = "max-sm:w-full";

  if (access === "download") {
    return (
      <a
        href={ebookDownloadHref(ebookId)}
        aria-label={text.downloadLabel(title)}
        className={buttonClasses({ className: cn(full, className) })}
      >
        <Download aria-hidden className="size-4.5" />
        {text.download}
      </a>
    );
  }
  if (access === "sign_in") {
    return (
      <Link href={signInPath(ebookHref(slug))} className={buttonClasses({ className: cn(full, className) })}>
        {text.signIn}
      </Link>
    );
  }
  if (access === "paused") return <PausedNote className={className}>{text.pausedLine}</PausedNote>;
  if (access === "unavailable") {
    return <p className={cn("text-sm font-medium text-muted", className)}>{text.unavailable}</p>;
  }

  const add = () =>
    startTransition(async () => {
      setResult(await addEbookToCartAction({ ebookId }));
    });
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Button loading={pending} onClick={add} className={full} aria-label={`${text.addToCart}: ${title}`}>
        {text.addToCart}
      </Button>
      {paused && <p className="text-small text-muted">{text.pausedLine}</p>}
      <div aria-live="polite">
        {result?.ok && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-teal-soft px-3.5 py-3 text-sm font-medium text-teal-dark">
            <CircleCheck aria-hidden className="size-4.5 shrink-0" />
            <span>{text.inCart}</span>
            <Link href="/cart" className="font-extrabold text-teal underline underline-offset-4">
              {text.viewCart}
            </Link>
          </p>
        )}
      </div>
      {result && !result.ok && <FormAlert>{result.message}</FormAlert>}
    </div>
  );
}
