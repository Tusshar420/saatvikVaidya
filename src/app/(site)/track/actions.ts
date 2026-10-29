"use server";

import { formValues } from "@/server/admin/form";
import { trackInputSchema, trackOrder, type TrackingView } from "@/server/orders/tracking";
import { requestIp } from "@/server/request-origin";

// Track Order (the /track page and the header/footer modal). No sign-in:
// the order number plus the phone or email on the order find it. Limits and
// the "not found" rule are in trackOrder().

export type TrackState = {
  status: "idle" | "error" | "found";
  /** Which field to point at, or the whole form. */
  error?: "number" | "contact" | "not_found" | "rate_limited";
  values?: { number: string; contact: string };
  tracking?: TrackingView;
};

export async function trackOrderAction(_: TrackState, formData: FormData): Promise<TrackState> {
  const raw = formValues(formData);
  const values = { number: (raw.number ?? "").slice(0, 40), contact: (raw.contact ?? "").slice(0, 191) };
  const parsed = trackInputSchema.safeParse(values);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] === "contact" ? "contact" : "number";
    return { status: "error", error: field, values };
  }
  const result = await trackOrder(parsed.data, await requestIp());
  if (!result.ok) return { status: "error", error: result.error, values };
  return { status: "found", values, tracking: result.tracking };
}
