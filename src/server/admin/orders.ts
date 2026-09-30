import { z } from "zod";

// Filters for /admin/orders. The Order model arrives with checkout (P1.3);
// until then the page has the filters ready and no rows.

export const orderStatuses = [
  "placed",
  "confirmed",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const isoDate = z.iso.date();

/** Invalid values are dropped, so a bad link still shows the page. */
export const orderFiltersSchema = z.object({
  status: z
    .preprocess(first, z.enum(orderStatuses).optional())
    .catch(undefined),
  from: z.preprocess(first, isoDate.optional()).catch(undefined),
  to: z.preprocess(first, isoDate.optional()).catch(undefined),
});

export type OrderFilters = z.infer<typeof orderFiltersSchema>;
