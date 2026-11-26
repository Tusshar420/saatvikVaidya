"use client";

import { useActionState } from "react";
import { ArrowRight, PackagePlus, Undo2, X } from "lucide-react";
import {
  createShipmentAction,
  simulateShipmentAction,
} from "@/app/admin/orders/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { orders as ordersCopy } from "@/content/orders";
import { idleForm, type FormState } from "@/server/admin/form";
import {
  canMoveShipment,
  nextShipmentStep,
  type ShipmentStatusKey,
} from "@/lib/shipping";
import { dangerButtonClasses } from "./confirm-delete";

const text = copy.orderDetail;

export type ShipmentPanelProps = {
  orderId: string;
  /** Only a paid order can get a shipment. */
  canCreate: boolean;
  shipment: { status: ShipmentStatusKey; courierName: string; awb: string } | null;
  /**
   * The team books the courier itself (SHIPPING_PROVIDER=manual): "Create
   * shipment" asks for the courier and tracking number, and the step buttons
   * read "Mark as: …" instead of "Simulate next step".
   */
  manual?: boolean;
};

/**
 * The shipment's controls: "Create shipment" on a paid order, then
 * "Simulate next step" ("Mark as: …" when manual) and, where they apply, "Mark undelivered" and "Mark
 * returned". Each button sends the step it was shown for, so a double
 * click moves the parcel once.
 */
export function ShipmentPanel({ orderId, canCreate, shipment, manual = false }: ShipmentPanelProps) {
  const [state, action, pending] = useActionState(
    (previous: FormState, formData: FormData) =>
      formData.get("intent") === "create"
        ? createShipmentAction(previous, formData)
        : simulateShipmentAction(previous, formData),
    idleForm,
  );
  const next = shipment ? nextShipmentStep(shipment.status) : null;
  const can = (to: ShipmentStatusKey) => (shipment ? canMoveShipment(shipment.status, to) : false);
  const stepLabel = manual ? text.markStep : text.simulateNext;
  const typed = state.status === "error" ? state.values : undefined;

  return (
    <div className="flex flex-col gap-4">
      {shipment ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-small text-muted">{text.courier}</dt>
            <dd className="font-semibold break-words text-ink">{shipment.courierName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-small text-muted">{text.awb}</dt>
            <dd className="font-mono font-semibold break-all text-ink">{shipment.awb}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">{text.shipmentStatus}</dt>
            <dd className="font-semibold text-ink">{ordersCopy.shipmentStatus[shipment.status]}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted">
          {!canCreate ? text.shipmentNotYet : manual ? text.manualIntro : text.shipmentIntro}
        </p>
      )}

      <form action={action} className="flex flex-wrap gap-2 max-sm:*:w-full">
        <input type="hidden" name="orderId" value={orderId} />
        {!shipment && canCreate && manual && (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Input
              name="courierName"
              label={text.manualCourier}
              help={text.manualCourierHelp}
              optional
              maxLength={80}
              autoComplete="off"
              defaultValue={typed?.courierName ?? ""}
            />
            <Input
              name="trackingNumber"
              label={text.manualTracking}
              help={text.manualTrackingHelp}
              optional
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              defaultValue={typed?.trackingNumber ?? ""}
            />
          </div>
        )}
        {!shipment && canCreate && (
          <Button
            type="submit"
            name="intent"
            value="create"
            loading={pending}
            icon={<PackagePlus aria-hidden className="size-4.5" />}
          >
            {text.createShipment}
          </Button>
        )}
        {shipment && (
          <>
            <input type="hidden" name="from" value={shipment.status} />
            {next && (
              <Button
                type="submit"
                name="step"
                value="next"
                loading={pending}
                icon={<ArrowRight aria-hidden className="size-4.5" />}
              >
                {stepLabel(ordersCopy.shipmentStatus[next])}
              </Button>
            )}
            {can("undelivered") && (
              <Button
                type="submit"
                name="step"
                value="undelivered"
                variant="secondary"
                disabled={pending}
                icon={<X aria-hidden className="size-4" />}
                className={dangerButtonClasses}
              >
                {text.markUndelivered}
              </Button>
            )}
            {can("returned") && (
              <Button
                type="submit"
                name="step"
                value="returned"
                variant="secondary"
                disabled={pending}
                icon={<Undo2 aria-hidden className="size-4" />}
                className={dangerButtonClasses}
              >
                {text.markReturned}
              </Button>
            )}
            {!next && <p className="text-sm text-muted">{text.finished}</p>}
          </>
        )}
      </form>

      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>{state.message}</FormAlert>
      )}
    </div>
  );
}
