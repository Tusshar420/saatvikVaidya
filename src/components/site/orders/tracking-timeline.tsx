import { Check, CircleAlert, CircleCheck, Clock, FlaskConical, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { Stepper } from "@/components/ui/stepper";
import { orders as copy } from "@/content/orders";
import { ui } from "@/content/ui";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDayMonth } from "@/lib/format";
import type { TrackingView } from "@/server/orders/tracking";

const text = copy.tracking;

function Note({ tone, icon, children }: { tone: "info" | "warn" | "done"; icon: ReactNode; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex gap-3 rounded-lg p-4 text-sm text-ink",
        tone === "info" && "bg-teal-soft",
        tone === "warn" && "bg-orange-soft",
        tone === "done" && "bg-teal-soft",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0 *:size-5",
          tone === "warn" ? "text-orange-ink" : tone === "done" ? "text-green" : "text-teal",
        )}
      >
        {icon}
      </span>
      {children}
    </p>
  );
}

/** What the buyer should know right now, in one line (or nothing). */
function statusNote(tracking: TrackingView): ReactNode {
  const shipment = tracking.shipment?.status;
  switch (tracking.status) {
    case "pending_payment":
      return <Note tone="warn" icon={<Clock />}>{text.awaitingPayment}</Note>;
    case "payment_failed":
      return <Note tone="warn" icon={<CircleAlert />}>{text.paymentFailed}</Note>;
    case "cancelled":
      return <Note tone="warn" icon={<CircleAlert />}>{text.cancelled}</Note>;
    case "returned":
      return <Note tone="warn" icon={<CircleAlert />}>{text.returned}</Note>;
    case "delivered":
      return <Note tone="done" icon={<CircleCheck />}>{text.delivered}</Note>;
    default:
      if (shipment === "undelivered") {
        return <Note tone="warn" icon={<CircleAlert />}>{text.undelivered}</Note>;
      }
      if (!tracking.shipment || shipment === "created") {
        return <Note tone="info" icon={<Truck />}>{text.notShipped}</Note>;
      }
      return null;
  }
}

/** The timeline as a vertical list, for phones (under 560 px). */
function VerticalSteps({ tracking, current }: { tracking: TrackingView; current: number }) {
  return (
    <ol aria-label={text.timelineLabel(tracking.number)} className="flex flex-col sm:hidden">
      {tracking.steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.key}
            aria-current={active ? "step" : undefined}
            className="relative flex items-center gap-3 py-1.5"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute -top-1/2 left-3.25 h-full w-0.5",
                  index <= current ? "bg-green" : "bg-track",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                done && "bg-green text-white",
                active && "bg-orange-strong text-white ring-5 ring-orange/15",
                !done && !active && "border border-line bg-surface text-muted",
              )}
            >
              {done ? <Check strokeWidth={3} className="size-3.5" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
              <span className={cn("text-sm text-ink", active ? "font-bold" : "font-semibold")}>
                {copy.steps[step.key]}
                {done && <span className="sr-only"> ({ui.stepper.done})</span>}
                {active && <span className="sr-only"> ({ui.stepper.current})</span>}
              </span>
              {step.at && <span className="text-small text-muted">{formatDayMonth(step.at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * An order's delivery: courier and tracking number, the step timeline and
 * the full tracking history. Used on the order page, /track and the Track
 * Order modal.
 */
export function TrackingTimeline({
  tracking,
  headingLevel = "h2",
  className,
}: {
  tracking: TrackingView;
  /** Level of the "Tracking history" heading. */
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
}) {
  const Heading = headingLevel;
  const { shipment } = tracking;
  const showCourier = shipment && shipment.status !== "cancelled";
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {showCourier && (
        <div className="flex flex-col gap-2">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <dt className="text-small text-muted">{text.courier}</dt>
              <dd className="font-semibold break-words text-ink">{shipment.courierName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-small text-muted">{text.awb}</dt>
              <dd className="font-mono font-semibold break-all text-ink">{shipment.awb}</dd>
            </div>
          </dl>
          {shipment.provider === "test" && (
            <p className="flex items-center gap-2 text-small text-muted">
              <FlaskConical aria-hidden className="size-4 shrink-0 text-orange-ink" />
              {text.testCourier}
            </p>
          )}
        </div>
      )}

      {tracking.current !== null && (
        <div className="rounded-lg border border-line bg-surface-alt px-4 py-3.5 sm:px-3 sm:pb-4">
          {/* Six steps don't fit side by side on a phone, so they stack there. */}
          <Stepper
            steps={tracking.steps.map((step) => ({
              label: copy.steps[step.key],
              detail: step.at ? formatDayMonth(step.at) : undefined,
            }))}
            current={tracking.current}
            label={text.timelineLabel(tracking.number)}
            className="max-sm:hidden"
          />
          <VerticalSteps tracking={tracking} current={tracking.current} />
        </div>
      )}

      {statusNote(tracking)}

      {tracking.events.length > 0 && (
        <section aria-label={text.historyTitle}>
          <Heading className="text-label text-muted uppercase">{text.historyTitle}</Heading>
          <ol aria-label={text.historyLabel} className="mt-3 flex flex-col">
            {tracking.events.map((event, index) => (
              <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < tracking.events.length - 1 && (
                  <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-0.5 bg-line" />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative mt-1 size-3 shrink-0 rounded-full",
                    index === 0 ? "bg-orange-strong ring-4 ring-orange/15" : "bg-green",
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold text-ink">{copy.shipmentStatus[event.status]}</span>
                  <span className="text-small text-muted">
                    {formatDateTime(event.at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
