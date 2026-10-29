"use client";

import { useTransition } from "react";
import Link from "next/link";
import { GraduationCap, Trash2 } from "lucide-react";
import { removeCourseFromCartAction } from "@/app/(site)/cart/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cart as copy } from "@/content/cart";
import { courses as coursesCopy } from "@/content/courses";
import { cn } from "@/lib/cn";
import { courseHref } from "@/lib/courses";
import { formatPaise } from "@/lib/format";
import type { CartCourseLine } from "@/server/cart/cart";

const text = coursesCopy.cartLine;

/** A course seat in the cart: one each, nothing to deliver; remove only. */
export function CartCourseItem({ line }: { line: CartCourseLine }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const issueId = `cart-course-issue-${line.courseId}`;

  const remove = () =>
    startTransition(async () => {
      const result = await removeCourseFromCartAction({ courseId: line.courseId });
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
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-md bg-brand-soft text-brand sm:size-18"
        >
          <GraduationCap className="size-7" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-small text-muted">{text.kind}</p>
          <h3 className="text-base font-extrabold break-words text-ink">
            <Link href={courseHref(line.key)} className="hover:text-brand hover:underline">
              {line.title}
            </Link>
          </h3>
          {line.instructor && <p className="text-small text-muted">{text.by(line.instructor)}</p>}
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
          aria-label={text.removeLabel(line.title)}
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
          {line.issue.kind === "enrolled" ? text.enrolled : text.unavailable}
        </p>
      )}
    </li>
  );
}
