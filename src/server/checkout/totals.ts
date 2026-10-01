// Cart and order totals (docs/CHUNKS.md, P1.4). Prices include GST, so the
// tax is the part of each line total that is GST; it isn't added on top.
// Pure functions with no database access, so the sums are easy to test. The
// same function totals the cart, the checkout summary and the order.

/** The delivery charge setting ("checkout.shipping"). */
export type ShippingRule = {
  feePaise: number;
  /** Order value (items total) from which delivery is free; null: never. */
  freeFromPaise: number | null;
};

/**
 * The GST inside a GST-inclusive amount, to the nearest paisa:
 * 10,500 paise at 5% holds 500 paise of GST.
 */
export function gstIncluded(amountPaise: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0;
  return Math.round((amountPaise * ratePercent) / (100 + ratePercent));
}

export type TotalsLine = {
  /** Unit price × quantity, including GST. */
  lineTotalPaise: number;
  gstRate: number;
};

export type GstGroup = {
  rate: number;
  /** Line totals at this rate, without the GST. */
  taxablePaise: number;
  taxPaise: number;
};

export type OrderTotals = {
  /** Sum of the line totals, including GST. */
  subtotalPaise: number;
  /** GST inside the subtotal (the sum of each line's GST). */
  taxPaise: number;
  /** GST by rate, lowest rate first. */
  gst: GstGroup[];
  shippingPaise: number;
  totalPaise: number;
  freeFromPaise: number | null;
  /** How much more would make delivery free; null when it already is or never will be. */
  toFreeShippingPaise: number | null;
};

/** The delivery charge for an items total. Nothing to deliver costs nothing. */
export function shippingFor(subtotalPaise: number, rule: ShippingRule): number {
  if (subtotalPaise <= 0) return 0;
  if (rule.freeFromPaise !== null && subtotalPaise >= rule.freeFromPaise) return 0;
  return rule.feePaise;
}

export function computeTotals(
  lines: readonly TotalsLine[],
  shipping: ShippingRule,
): OrderTotals {
  const groups = new Map<number, GstGroup>();
  let subtotalPaise = 0;
  let taxPaise = 0;
  for (const line of lines) {
    const tax = gstIncluded(line.lineTotalPaise, line.gstRate);
    subtotalPaise += line.lineTotalPaise;
    taxPaise += tax;
    const group = groups.get(line.gstRate) ?? {
      rate: line.gstRate,
      taxablePaise: 0,
      taxPaise: 0,
    };
    group.taxablePaise += line.lineTotalPaise - tax;
    group.taxPaise += tax;
    groups.set(line.gstRate, group);
  }
  const shippingPaise = shippingFor(subtotalPaise, shipping);
  const toFree =
    shipping.freeFromPaise !== null && shippingPaise > 0
      ? shipping.freeFromPaise - subtotalPaise
      : null;
  return {
    subtotalPaise,
    taxPaise,
    gst: [...groups.values()].sort((a, b) => a.rate - b.rate),
    shippingPaise,
    totalPaise: subtotalPaise + shippingPaise,
    freeFromPaise: shipping.freeFromPaise,
    toFreeShippingPaise: toFree !== null && toFree > 0 ? toFree : null,
  };
}
