/** Nested `stockItem` data for product.create: one batch of `quantity` units (no expiry). No imports, so e2e files can use it. */
export const stockCreate = (name: string, quantity: number) => ({
  create: {
    kind: "finished" as const,
    name,
    onHand: quantity,
    batches: { create: { batchNo: "TEST", qtyOnHand: quantity } },
  },
});
