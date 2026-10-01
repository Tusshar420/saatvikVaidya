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
  className,
}: {
  /** Level of the result's heading (its history heading is one below). */
  headingLevel?: "h2" | "h3";
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

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <form action={action} noValidate aria-describedby={formError ? alertId : undefined} className="flex flex-col gap-4">
        {formError && (
          <FormAlert id={alertId}>{formError}</FormAlert>
        )}
        <Input
          id={`${id}-number`}
          name="number"
          label={text.number}
          placeholder={text.numberPlaceholder}
          help={text.numberHelp}
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
        <Button type="submit" loading={pending} className="w-full sm:w-auto sm:self-start">
          {tracking ? text.again : text.submit}
          <ButtonArrow />
        </Button>
      </form>

      {tracking && (
        <section aria-labelledby={`${id}-result`} className="border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Heading
              id={`${id}-result`}
              ref={resultRef}
              tabIndex={-1}
              className="text-h3 text-ink outline-none"
            >
              {text.resultTitle(tracking.number)}
            </Heading>
            <OrderStatusBadge status={tracking.status} />
          </div>
          <TrackingTimeline
            tracking={tracking}
            headingLevel={headingLevel === "h2" ? "h3" : "h4"}
            className="mt-4"
          />
        </section>
      )}
    </div>
  );
}
