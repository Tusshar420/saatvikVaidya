"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { removeEbookFromCartAction } from "@/app/(site)/cart/actions";
import { EbookCover } from "@/components/site/ebooks/ebook-cover";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cart as copy } from "@/content/cart";
import { cn } from "@/lib/cn";
import { ebookHref } from "@/lib/ebooks";
import { formatPaise } from "@/lib/format";
import type { CartEbookLine } from "@/server/cart/cart";

const text = copy.ebook;

/** A paid ebook in the cart: one copy, nothing to deliver; remove only. */
export function CartEbookItem({ line }: { line: CartEbookLine }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const issueId = `cart-ebook-issue-${line.ebookId}`;

  const remove = () =>
    startTransition(async () => {
      const result = await removeEbookFromCartAction({ ebookId: line.ebookId });
      if (result.ok) toast({ title: copy.removed, description: line.title });
      else toast({ tone: "error", title: result.message });
    });

  return (
    <li
      className={cn(
        "rounded-lg border bg-surface p-4 shadow-card sm:p-5 md:rounded-[21px]",
        line.issue ? "border-danger/50" : "border-line",
      )}
    >
      <div className="flex gap-4">
        <Link href={ebookHref(line.slug)} tabIndex={-1} aria-hidden className="w-16 shrink-0 sm:w-18">
          <EbookCover src={line.cover} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-small text-muted">{text.kind}</p>
          <h3 className="text-base font-extrabold text-ink">
            <Link href={ebookHref(line.slug)} className="hover:text-brand hover:underline">
              {line.title}
            </Link>
          </h3>
          {line.author && <p className="text-small text-muted">{text.by(line.author)}</p>}
          <p className="text-small text-muted">{text.note}</p>
        </div>
      </div>
      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
        aria-busy={pending || undefined}
      >
        <Button
          variant="link"
          size="sm"
          disabled={pending}
          aria-label={copy.line.removeLabel(line.title)}
          aria-describedby={line.issue ? issueId : undefined}
          icon={<Trash2 aria-hidden className="size-4" />}
          onClick={remove}
        >
          {copy.line.remove}
        </Button>
        {!line.issue && (
          <p className="text-right text-sm">
            <span className="block text-small text-muted">{copy.line.lineTotal}</span>
            <span className="text-lg font-extrabold text-ink">{formatPaise(line.lineTotalPaise)}</span>
          </p>
        )}
      </div>
      {line.issue && (
        <p id={issueId} className="mt-2 text-small font-bold text-danger">
          {line.issue.kind === "owned" ? text.owned : text.unavailable}
        </p>
      )}
    </li>
  );
}
