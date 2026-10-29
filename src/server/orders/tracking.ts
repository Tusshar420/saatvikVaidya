import "server-only";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { isOrderId, orderNumberPattern } from "@/lib/orders";
import { toIndianE164 } from "@/lib/phone";
import {
  trackingCurrent,
  trackingSteps,
  type ShipmentStatusKey,
  type TrackingStepKey,
} from "@/lib/shipping";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";

// What a buyer sees about delivery (docs/CHUNKS.md, P1.5): the timeline on
// /orders/[id], and the same timeline on /track and in the Track Order
// modal, found by order number plus the phone or email on the order.

export type TrackingView = {
  number: string;
  status: OrderStatus;
  placedAt: Date;
  shipment: {
    courierName: string;
    awb: string;
    provider: string;
    status: ShipmentStatusKey;
  } | null;
  /** The timeline's steps with when each was reached. */
  steps: { key: TrackingStepKey; at: Date | null }[];
  /** Index of the step happening now (see trackingCurrent), or null when there's no timeline. */
  current: number | null;
  /** Every shipment step, newest first. */
  events: { id: number; status: ShipmentStatusKey; at: Date; location: string | null }[];
};

const trackingSelect = {
  number: true,
  status: true,
  createdAt: true,
  paidAt: true,
  shipment: {
    select: {
      courierName: true,
      awb: true,
      provider: true,
      status: true,
      events: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, status: true, createdAt: true, location: true },
      },
    },
  },
} satisfies Prisma.OrderSelect;

type TrackingRow = {
  number: string;
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
  shipment: {
    courierName: string;
    awb: string;
    provider: string;
    status: ShipmentStatusKey;
    events: { id: number; status: ShipmentStatusKey; createdAt: Date; location: string | null }[];
  } | null;
};

function toView(order: TrackingRow): TrackingView {
  const events = order.shipment?.events ?? [];
  /** When a step was first reached (events are newest first). */
  const reached = (status: ShipmentStatusKey) =>
    events.findLast((event) => event.status === status)?.createdAt ?? null;
  return {
    number: order.number,
    status: order.status,
    placedAt: order.createdAt,
    shipment: order.shipment
      ? {
          courierName: order.shipment.courierName,
          awb: order.shipment.awb,
          provider: order.shipment.provider,
          status: order.shipment.status,
        }
      : null,
    steps: trackingSteps.map((key) => ({
      key,
      at: key === "confirmed" ? order.paidAt : reached(key),
    })),
    current: trackingCurrent(order.status, order.shipment?.status ?? null),
    events: events.map((event) => ({
      id: event.id,
      status: event.status,
      at: event.createdAt,
      location: event.location,
    })),
  };
}

/** Tracking for one of the user's own orders, or null. */
export async function readTrackingForUser(userId: string, orderId: string): Promise<TrackingView | null> {
  if (!isOrderId(orderId)) return null;
  const order = await db.order.findFirst({ where: { id: orderId, userId }, select: trackingSelect });
  return order ? toView(order) : null;
}

/** Tracking for any order (admin pages check the session first). */
export async function readTracking(orderId: string): Promise<TrackingView | null> {
  if (!isOrderId(orderId)) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, select: trackingSelect });
  return order ? toView(order) : null;
}

// ─── Track Order (no sign-in) ───────────────────────────────────────────────

/** "sv-7k2q 9f4m" or "7K2Q9F4M" -> "SV-7K2Q9F4M". */
function normalizeOrderNumber(raw: string): string {
  const compact = raw.toUpperCase().replace(/[\s-]/g, "");
  return `SV-${compact.startsWith("SV") ? compact.slice(2) : compact}`;
}

export const trackInputSchema = z.object({
  number: z
    .string()
    .max(40)
    .transform(normalizeOrderNumber)
    .pipe(z.string().regex(orderNumberPattern)),
  contact: z
    .string()
    .trim()
    .max(191)
    .transform((value, ctx) => {
      if (value.includes("@")) {
        const email = z.email().safeParse(value.toLowerCase());
        if (email.success) return { kind: "email" as const, value: email.data };
      } else {
        const phone = toIndianE164(value);
        if (phone) return { kind: "phone" as const, value: phone };
      }
      ctx.addIssue({ code: "custom", message: "contact" });
      return z.NEVER;
    }),
});

export type TrackInput = z.infer<typeof trackInputSchema>;

export type TrackResult =
  | { ok: true; tracking: TrackingView }
  | { ok: false; error: "not_found" | "rate_limited" };

/**
 * Finds an order by its number and the phone or email on it (the delivery
 * phone, or the account's phone or email). Every lookup counts against the
 * caller's IP and against the order number, and a wrong number or wrong
 * contact give the same answer, so it never reveals whether an order exists.
 */
export async function trackOrder(input: TrackInput, ip: string): Promise<TrackResult> {
  const [byIp, byNumber] = await Promise.all([
    hitRateLimit(rateLimitRules.trackOrderPerIp, ip),
    hitRateLimit(rateLimitRules.trackOrderPerNumber, input.number),
  ]);
  if (!byIp.allowed || !byNumber.allowed) return { ok: false, error: "rate_limited" };

  const order = await db.order.findUnique({
    where: { number: input.number },
    select: {
      ...trackingSelect,
      shipPhone: true,
      user: { select: { email: true, phoneNumber: true } },
    },
  });
  if (!order) return { ok: false, error: "not_found" };
  const { contact } = input;
  const matches =
    contact.kind === "phone"
      ? contact.value === order.shipPhone || contact.value === order.user?.phoneNumber
      : Boolean(
          order.user &&
            !isPlaceholderEmail(order.user.email) &&
            order.user.email.toLowerCase() === contact.value,
        );
  if (!matches) return { ok: false, error: "not_found" };
  return { ok: true, tracking: toView(order) };
}
