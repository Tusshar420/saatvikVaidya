"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { addCourseToCartAction, type CartActionResult } from "@/app/(site)/cart/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { courses as copy } from "@/content/courses";
import { cn } from "@/lib/cn";

const text = copy.page;

/**
 * "Enrol": puts a seat on the course in the cart; the buyer then checks out
 * and pays like any order. The server checks the course is on sale and that
 * the buyer isn't enrolled already.
 */
export function CourseEnrol({
  courseId,
  title,
  inCart,
  className,
}: {
  courseId: number;
  title: string;
  inCart: boolean;
  className?: string;
}) {
  const [result, setResult] = useState<CartActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const added = inCart || result?.ok === true;

  const add = () =>
    startTransition(async () => {
      setResult(await addCourseToCartAction({ courseId }));
    });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {added ? (
        <Link href="/cart" className={buttonClasses({ className: "max-sm:w-full sm:w-fit" })}>
          {text.goToCart}
        </Link>
      ) : (
        <Button
          loading={pending}
          onClick={add}
          className="max-sm:w-full sm:w-fit"
          aria-label={`${text.enrol}: ${title}`}
        >
          {text.enrol}
        </Button>
      )}
      <div aria-live="polite">
        {added && (
          <p className="flex items-start gap-2 rounded-lg bg-brand-soft px-3.5 py-3 text-sm font-medium text-brand-dark">
            <CircleCheck aria-hidden className="mt-0.5 size-4.5 shrink-0" />
            <span>{result?.ok ? text.addedLine(title) : text.inCart}</span>
          </p>
        )}
      </div>
      {result && !result.ok && <FormAlert>{result.message}</FormAlert>}
    </div>
  );
}
