import type { Prisma } from "@/generated/prisma/client";
import type { StockKind, StockUnit } from "@/generated/prisma/client";

// Starter inventory for the sample catalogue. Idempotent: components are only
// made when none exist, and a product's stock item only when it is missing.
// Writes rows directly (no engine import): the seed runs outside Next.js,
// where the engine's "server-only" guard would refuse to load.

type Tx = Prisma.TransactionClient;

/** Opening stock for an item: on hand, one batch for finished goods, and its receipt. */
async function openingReceipt(tx: Tx, itemId: number, kind: StockKind, quantity: number, reason: string) {
  const batch =
    kind === "finished"
      ? await tx.stockBatch.create({ data: { itemId, batchNo: "OPENING", qtyOnHand: quantity }, select: { id: true } })
      : null;
  await tx.stockItem.update({ where: { id: itemId }, data: { onHand: quantity } });
  await tx.stockMovement.create({
    data: {
      itemId,
      batchId: batch?.id ?? null,
      type: "receipt",
      quantity,
      onHandDelta: quantity,
      reservedDelta: 0,
      onHandAfter: quantity,
      reason,
    },
  });
}

/** A product's finished-goods item, with `stock` units as an opening batch if it is new. */
export async function seedProductStock(tx: Tx, product: { id: number; name: string }, stock: number): Promise<void> {
  const existing = await tx.stockItem.findUnique({ where: { productId: product.id }, select: { id: true } });
  if (existing) return;
  const item = await tx.stockItem.create({
    data: { kind: "finished", name: product.name.slice(0, 160), unit: "pcs", productId: product.id, lowThreshold: stock > 0 ? 10 : 0 },
    select: { id: true },
  });
  if (stock > 0) await openingReceipt(tx, item.id, "finished", stock, "Sample opening stock");
}

type ComponentSeed = {
  key: string;
  name: string;
  kind: Exclude<StockKind, "finished">;
  unit: StockUnit;
  componentType: string;
  onHand: number;
  lowThreshold: number;
  madeToOrder?: boolean;
};

const components: ComponentSeed[] = [
  { key: "bottle-200", name: "Amber bottle 200 ml", kind: "packaging", unit: "pcs", componentType: "bottle", onHand: 2000, lowThreshold: 300 },
  { key: "bottle-450", name: "Amber bottle 450 ml", kind: "packaging", unit: "pcs", componentType: "bottle", onHand: 800, lowThreshold: 150 },
  { key: "jar-100", name: "Jar 100 g", kind: "packaging", unit: "pcs", componentType: "jar", onHand: 1500, lowThreshold: 250 },
  { key: "jar-250", name: "Jar 250 g", kind: "packaging", unit: "pcs", componentType: "jar", onHand: 600, lowThreshold: 100 },
  { key: "cap-std", name: "Screw cap", kind: "packaging", unit: "pcs", componentType: "cap", onHand: 6000, lowThreshold: 800 },
  { key: "label-stock", name: "Label stock (printed per order)", kind: "packaging", unit: "pcs", componentType: "label", onHand: 8000, lowThreshold: 1000 },
  { key: "base-syrup", name: "Asava/arishta base", kind: "base", unit: "ml", componentType: "base", onHand: 400_000, lowThreshold: 60_000 },
  { key: "base-avaleha", name: "Avaleha base", kind: "base", unit: "g", componentType: "base", onHand: 120_000, lowThreshold: 20_000 },
  { key: "base-churna", name: "Churna base", kind: "base", unit: "g", componentType: "base", onHand: 0, lowThreshold: 0, madeToOrder: true },
];

/** slug -> [component key, quantity per unit in the component's base unit][] */
const recipes: Record<string, [string, number][]> = {
  "punarnava-mandoor": [["bottle-200", 1], ["cap-std", 1], ["label-stock", 1]],
  "triphala-churna": [["jar-100", 1], ["cap-std", 1], ["label-stock", 1], ["base-churna", 100]],
  dashmoolarishta: [["bottle-450", 1], ["cap-std", 1], ["label-stock", 1], ["base-syrup", 450]],
  vasavaleha: [["jar-250", 1], ["cap-std", 1], ["label-stock", 1], ["base-avaleha", 250]],
};

export async function seedInventoryComponents(tx: Tx): Promise<void> {
  if ((await tx.stockItem.count({ where: { kind: { not: "finished" } } })) > 0) return;
  const ids = new Map<string, number>();
  for (const seed of components) {
    const item = await tx.stockItem.create({
      data: {
        kind: seed.kind,
        name: seed.name,
        sku: `COMP-${seed.key}`,
        unit: seed.unit,
        componentType: seed.componentType,
        lowThreshold: seed.lowThreshold,
        madeToOrder: seed.madeToOrder ?? false,
      },
      select: { id: true },
    });
    ids.set(seed.key, item.id);
    if (seed.onHand > 0) {
      await openingReceipt(tx, item.id, seed.kind, seed.onHand, "Sample opening stock");
    }
  }
  for (const [slug, lines] of Object.entries(recipes)) {
    const product = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) continue;
    await tx.recipeLine.createMany({
      data: lines.map(([key, quantity]) => ({ productId: product.id, componentId: ids.get(key)!, quantity })),
    });
  }
}
