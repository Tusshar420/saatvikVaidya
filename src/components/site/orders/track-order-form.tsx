"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { trackOrderAction, type TrackState } from "@/app/(site)/track/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orders as copy } from "@/content/orders";
import { cn } from "@/lib/cn";
import { OrderStatusBadge } from "./order-status-badge";
import { TrackingTimeline } from "./tracking-timeline";

const text = copy.track;
const idle: TrackState = { status: "idle" };

/**
 * Order number plus the phone or email on the order, then the order's
 * timeline below the form. Used on /track and in the Track Order modal.
 */
export function TrackOrderForm({
  headingLevel = "h2",
  variant = "stack",
  className,
}: {
  /** Level of the result's heading (its history heading is one below). */
  headingLevel?: "h2" | "h3";
  /**
   * `stack` (the modal): fields one under another. `page` (/track): the v2
   * search card with both fields and the button in one row, and the result in
   * its own card below.
   */
  variant?: "stack" | "page";
  className?: string;
}) {
  const [state, action, pending] = useActionState(trackOrderAction, idle);
  const id = useId();
  const resultRef = useRef<HTMLHeadingElement>(null);
  const alertId = `${id}-alert`;
  const formError =
    state.error === "not_found"
      ? text.errors.notFound
      : state.error === "rate_limited"
        ? text.errors.rateLimited
        : null;

  // Move to the result once it's found, so screen readers hear it.
  useEffect(() => {
    if (state.status === "found") resultRef.current?.focus();
  }, [state]);

  const Heading = headingLevel;
  const tracking = state.status === "found" ? state.tracking : undefined;

  const page = variant === "page";
  const card = "rounded-xl border border-line bg-surface shadow-card max-sm:rounded-lg";

  return (
    <div className={cn("flex flex-col", page ? "gap-4.5" : "gap-6", className)}>
      <form
        action={action}
        noValidate
        aria-describedby={formError ? alertId : undefined}
        className={cn("flex flex-col gap-4", page && cn(card, "p-4.5 sm:p-7"))}
      >
        {formError && (
          <FormAlert id={alertId}>{formError}</FormAlert>
        )}
        <div className={cn("flex flex-col gap-4", page && "md:grid md:grid-cols-[1fr_1fr_auto] md:items-start md:gap-3")}>
          <Input
            id={`${id}-number`}
            name="number"
            label={text.number}
            placeholder={text.numberPlaceholder}
            help={page ? undefined : text.numberHelp}
            error={state.error === "number" ? text.errors.number : undefined}
            defaultValue={state.values?.number}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            required
          />
          <Input
            id={`${id}-contact`}
            name="contact"
            label={text.contact}
            placeholder={text.contactPlaceholder}
            error={state.error === "contact" ? text.errors.contact : undefined}
            defaultValue={state.values?.contact}
            autoComplete="off"
            spellCheck={false}
            maxLength={191}
            required
          />
          <div className={cn(page && "md:pt-5.5")}>
            <Button type="submit" loading={pending} className={cn("w-full", page ? "md:w-auto" : "sm:w-auto")}>
              {tracking ? text.again : text.submit}
              <ButtonArrow />
            </Button>
          </div>
        </div>
        {page && <p className="text-small text-muted">{text.numberHelp}</p>}
      </form>

      {tracking && (
        <section
          aria-labelledby={`${id}-result`}
          className={cn(page ? cn(card, "p-4.5 sm:p-7") : "border-t border-line pt-5")}
        >
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
              page && "border-b border-line pb-4.5",
            )}
          >
            <div className="flex min-w-0 flex-col">
              {page && <span className="text-small text-muted uppercase">{text.resultEyebrow}</span>}
              <Heading
                id={`${id}-result`}
                ref={resultRef}
                tabIndex={-1}
                className={cn("text-ink outline-none", page ? "mt-0.5 font-heading text-h4" : "text-h3")}
              >
                {text.resultTitle(tracking.number)}
              </Heading>
            </div>
            <OrderStatusBadge status={tracking.status} />
          </div>
          <TrackingTimeline
            tracking={tracking}
            headingLevel={headingLevel === "h2" ? "h3" : "h4"}
            className={page ? "mt-6" : "mt-4"}
          />
        </section>
      )}
    </div>
  );
}
