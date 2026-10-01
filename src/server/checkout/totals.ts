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
  /** Value of Super Coins used, taken off the items (P1.7). */
  coinDiscountPaise: number;
  /** Each line's share of the coin discount, in line order. */
  lineDiscountsPaise: number[];
  /** Subtotal minus coin discount plus delivery: what is paid. */
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

/**
 * Splits `discountPaise` over the lines in proportion to their totals, to the
 * paisa: each gets its rounded-down share, and the leftover paise go to the
 * lines with the biggest remainders. A line never gets more than its total.
 */
export function allocateDiscount(lineTotals: readonly number[], discountPaise: number): number[] {
  const total = lineTotals.reduce((sum, value) => sum + value, 0);
  const discount = Math.max(0, Math.min(discountPaise, total));
  if (discount === 0 || total === 0) return lineTotals.map(() => 0);
  const shares = lineTotals.map((value, index) => {
    const exact = value * discount;
    return { index, base: Math.floor(exact / total), rest: exact % total };
  });
  let left = discount - shares.reduce((sum, share) => sum + share.base, 0);
  const order = [...shares].sort((a, b) => b.rest - a.rest || a.index - b.index);
  const result = shares.map((share) => share.base);
  for (const share of order) {
    if (left === 0) break;
    if (result[share.index]! < lineTotals[share.index]!) {
      result[share.index]! += 1;
      left -= 1;
    }
  }
  return result;
}

/**
 * Totals for a set of lines. `coinDiscountPaise` is spread over the lines
 * first and each line's GST is worked out on what is left, as a discount
 * given on the invoice would be. Delivery is decided on the items total
 * before the discount.
 */
export function computeTotals(
  lines: readonly TotalsLine[],
  shipping: ShippingRule,
  coinDiscountPaise = 0,
): OrderTotals {
  const groups = new Map<number, GstGroup>();
  let subtotalPaise = 0;
  let taxPaise = 0;
  const gross = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
  const coinDiscount = Math.max(0, Math.min(coinDiscountPaise, gross));
  const lineDiscountsPaise = allocateDiscount(
    lines.map((line) => line.lineTotalPaise),
    coinDiscount,
  );
  for (const [index, line] of lines.entries()) {
    const net = line.lineTotalPaise - lineDiscountsPaise[index]!;
    const tax = gstIncluded(net, line.gstRate);
    subtotalPaise += line.lineTotalPaise;
    taxPaise += tax;
    const group = groups.get(line.gstRate) ?? {
      rate: line.gstRate,
      taxablePaise: 0,
      taxPaise: 0,
    };
    group.taxablePaise += net - tax;
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
    coinDiscountPaise: coinDiscount,
    lineDiscountsPaise,
    totalPaise: subtotalPaise - coinDiscount + shippingPaise,
    freeFromPaise: shipping.freeFromPaise,
    toFreeShippingPaise: toFree !== null && toFree > 0 ? toFree : null,
  };
}
