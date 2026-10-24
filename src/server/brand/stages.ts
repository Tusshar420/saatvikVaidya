import "server-only";
import type { BrandProofStatus, BrandStage, Prisma } from "@/generated/prisma/client";
import {
  actorMayMoveTo,
  brandProofUpload,
  canMoveBrandStage,
  canUploadProof,
  nextProductionStage,
  orderStatusForBrandStage,
  proofCommentMax,
  proofNoteMax,
  stageNoteMax,
  type StageActor,
} from "@/lib/brand-stage";
import { isOrderId } from "@/lib/orders";
import { logAdminAction } from "@/server/admin/audit";
import { db } from "@/server/db";
import { consumeBrandOrder } from "@/server/inventory/orders";
import {
  sendProofDecision,
  sendProofSent,
  sendStageUpdate,
} from "@/server/notify/brand";
import { getShippingProvider, simulatedEvent } from "@/server/shipping";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload, cleanFileName } from "@/server/storage/files";

// Label proofs and production of a paid brand order (docs/CHUNKS.md, P2.2).
// Every change of stage goes through moveStage(): it checks the transitions
// table (src/lib/brand-stage.ts) and who may make the change, claims the
// change from the stage it saw (so a double click or two people at once
// apply it once), keeps the order's own status in step, and logs the change
// with who made it and a note. Callers check the session first and pass the
// admin's or the customer's id.

export type StageError =
  | "not_found"
  | "not_paid"
  | "not_allowed"
  | "invalid"
  | "empty"
  | "tooLarge"
  | "fileType"
  | "shipping_off";

export type StageResult<T = object> = ({ ok: true; changed: boolean } & T) | { ok: false; error: StageError };

class Stale extends Error {}
class Refused extends Error {
  constructor(readonly code: StageError) {
    super(code);
  }
}

/** Order statuses a stage change may overwrite (never unpaid, cancelled or returned ones). */
const movableOrderStatuses = ["paid", "processing", "shipped"] as const;

type MoveOptions = {
  orderId: string;
  from: BrandStage;
  to: BrandStage;
  actor: StageActor;
  actorId: string | null;
  note?: string | null;
};

/**
 * Moves a brand order from `from` to `to` inside `tx`. Throws Refused when
 * the table or the actor doesn't allow it, and Stale when the order is no
 * longer at `from` (someone else moved it first).
 */
async function moveStage(tx: Prisma.TransactionClient, options: MoveOptions): Promise<void> {
  const { orderId, from, to, actor, actorId } = options;
  if (!canMoveBrandStage(from, to) || !actorMayMoveTo(actor, to)) throw new Refused("not_allowed");
  const claimed = await tx.brandOrderDetails.updateMany({
    where: { orderId, stage: from },
    data: { stage: to },
  });
  if (claimed.count === 0) throw new Stale();
  // Cancelling keeps its own order bookkeeping (cancelOrder in src/server/admin/orders.ts).
  if (to !== "cancelled") {
    await tx.order.updateMany({
      where: { id: orderId, status: { in: [...movableOrderStatuses] } },
      data: { status: orderStatusForBrandStage(to) },
    });
  }
  await tx.brandStageEvent.create({
    data: {
      orderId,
      fromStage: from,
      toStage: to,
      actorKind: actor,
      actorId,
      note: options.note?.slice(0, stageNoteMax) || null,
    },
  });
}

/**
 * Stage changes run at READ COMMITTED, like the coin ledger's: the default
 * (repeatable read) takes gap locks on the proof and event indexes, and two
 * orders being changed at once could then deadlock. The lock on the order's
 * own row (lockOrder) is what keeps one order's changes in line.
 */
function stageTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(work, { isolationLevel: "ReadCommitted" });
}

/** Locks the order's brand row and returns its stage and order status. */
async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  const rows = await tx.$queryRaw<{ stage: BrandStage }[]>`
    SELECT stage FROM BrandOrderDetails WHERE orderId = ${orderId} FOR UPDATE`;
  if (rows.length === 0) throw new Refused("not_found");
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, type: true, userId: true },
  });
  return { stage: rows[0]!.stage, ...order };
}

/** Called when a payment first succeeds: writes the opening event. */
export async function recordFirstStage(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  await tx.brandStageEvent.create({
    data: { orderId, fromStage: null, toStage: "awaiting_proof", actorKind: "system" },
  });
}

/** Records the stage change an admin's cancel made (called inside its transaction). */
export async function cancelStageInTx(
  tx: Prisma.TransactionClient,
  options: { orderId: string; from: BrandStage; actorId: string; note: string | null },
): Promise<boolean> {
  try {
    await moveStage(tx, { ...options, to: "cancelled", actor: "admin" });
    return true;
  } catch (error) {
    if (error instanceof Stale) return false;
    throw error;
  }
}

// ─── Proofs ─────────────────────────────────────────────────────────────────

export type ProofUploadResult = StageResult<{ version: number }>;

/**
 * The team sends a proof (a new version; earlier ones are kept). Allowed
 * while the order waits for a proof or the customer asked for changes, or
 * while a proof is out and undecided (the new one replaces it, so the
 * customer only decides on the latest). The file's type comes from its
 * bytes: PDF, PNG or JPEG, up to 10 MB.
 */
export async function uploadProof(options: {
  actorId: string;
  orderId: string;
  fileName: string;
  bytes: Uint8Array;
  note?: string | null;
}): Promise<ProofUploadResult> {
  const { actorId, orderId } = options;
  if (!isOrderId(orderId)) return { ok: false, error: "not_found" };
  const note = options.note?.trim() || null;
  if (note && note.length > proofNoteMax) return { ok: false, error: "invalid" };
  const checked = checkUpload(options.bytes, brandProofUpload);
  if (!checked.ok) return checked;
  const exists = await db.order.findFirst({
    where: { id: orderId, type: "brand" },
    select: { id: true },
  });
  if (!exists) return { ok: false, error: "not_found" };

  const fileKey = newFileKey("brand-proofs", orderId, checked.extension);
  await getStorage().put(fileKey, options.bytes);
  try {
    const version = await stageTransaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (current.type !== "brand") throw new Refused("not_found");
      if (current.status === "pending_payment" || current.status === "payment_failed") throw new Refused("not_paid");
      const replacing = current.stage === "proof_sent";
      if (!canUploadProof(current.stage) && !replacing) throw new Refused("not_allowed");

      const latest = await tx.brandProof.aggregate({ where: { orderId }, _max: { version: true } });
      const next = (latest._max.version ?? 0) + 1;
      // An undecided proof is replaced by the new one.
      await tx.brandProof.updateMany({
        where: { orderId, status: "pending" },
        data: { status: "superseded", decidedAt: new Date() },
      });
      await tx.brandProof.create({
        data: {
          orderId,
          version: next,
          fileKey,
          fileName: cleanFileName(options.fileName, checked.extension),
          contentType: checked.contentType,
          sizeBytes: options.bytes.byteLength,
          note,
          uploadedById: actorId,
        },
      });
      if (replacing) {
        // The stage stays "proof sent": record the swap as an event of its own.
        await tx.brandStageEvent.create({
          data: {
            orderId,
            fromStage: "proof_sent",
            toStage: "proof_sent",
            actorKind: "admin",
            actorId,
            note: note ?? null,
          },
        });
      } else {
        await moveStage(tx, {
          orderId,
          from: current.stage,
          to: "proof_sent",
          actor: "admin",
          actorId,
          note,
        });
      }
      await logAdminAction(tx, {
        actorId,
        action: "brand.proof.upload",
        resource: "Order",
        resourceId: orderId,
        changes: { proofVersion: { from: next - 1 || null, to: next } },
        note,
      });
      return next;
    });
    await notifyQuietly(() => sendProofSent(orderId, version));
    return { ok: true, changed: true, version };
  } catch (error) {
    await deleteFilesQuietly([fileKey]);
    return failure(error);
  }
}

export type ProofDecision = "approve" | "changes";

/**
 * The customer decides on the latest proof: approves it, or asks for
 * changes with a comment (required). Only the order's owner, only while the
 * proof is the one waiting for them, and only once.
 */
export async function decideProof(options: {
  userId: string;
  orderId: string;
  proofId: number;
  decision: ProofDecision;
  comment?: string | null;
}): Promise<StageResult> {
  const { userId, orderId, proofId, decision } = options;
  if (!isOrderId(orderId)) return { ok: false, error: "not_found" };
  const comment = options.comment?.trim() || null;
  if (decision === "changes" && (!comment || comment.length > proofCommentMax)) {
    return { ok: false, error: "invalid" };
  }
  const owned = await db.order.findFirst({
    where: { id: orderId, type: "brand", userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "not_found" };

  try {
    const version = await stageTransaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (current.userId !== userId) throw new Refused("not_found");
      if (current.stage !== "proof_sent") throw new Refused("not_allowed");
      const proofStatus: BrandProofStatus = decision === "approve" ? "approved" : "changes_requested";
      const decided = await tx.brandProof.updateMany({
        where: { id: proofId, orderId, status: "pending" },
        data: {
          status: proofStatus,
          comment: decision === "changes" ? comment : null,
          decidedAt: new Date(),
        },
      });
      if (decided.count === 0) throw new Refused("not_allowed");
      const proof = await tx.brandProof.findUniqueOrThrow({
        where: { id: proofId },
        select: { version: true },
      });
      await moveStage(tx, {
        orderId,
        from: "proof_sent",
        to: decision === "approve" ? "proof_approved" : "changes_requested",
        actor: "customer",
        actorId: userId,
        note: decision === "changes" ? comment : null,
      });
      return proof.version;
    });
    await notifyQuietly(() => sendProofDecision(orderId, decision, version, comment));
    return { ok: true, changed: true };
  } catch (error) {
    return failure(error);
  }
}

// ─── Production ─────────────────────────────────────────────────────────────

export type ProductionStep = "in_production" | "quality_check" | "dispatched" | "delivered";

export type ProductionResult = StageResult<{ stage: BrandStage }>;

/**
 * The team moves the order on: In production (from any stage before it; a
 * proof isn't needed), Quality check, Dispatched (books the parcel with the
 * shipping provider: the test one here) and Delivered. `from` is the stage the admin saw, so a
 * double click doesn't skip a step.
 */
export async function advanceProduction(options: {
  actorId: string;
  orderId: string;
  from: BrandStage;
  to: ProductionStep;
  note?: string | null;
}): Promise<ProductionResult> {
  const { actorId, orderId, from, to } = options;
  if (!isOrderId(orderId)) return { ok: false, error: "not_found" };
  const note = options.note?.trim() || null;
  if (note && note.length > stageNoteMax) return { ok: false, error: "invalid" };
  const order = await db.order.findFirst({
    where: { id: orderId, type: "brand" },
    select: {
      id: true,
      number: true,
      status: true,
      shipCity: true,
      shipState: true,
      shipPincode: true,
      brandDetails: { select: { stage: true } },
      items: { select: { quantity: true } },
    },
  });
  if (!order?.brandDetails) return { ok: false, error: "not_found" };
  const seen = order.brandDetails.stage;
  // Already moved on from what the admin saw (a double click): nothing to do.
  if (seen !== from) return { ok: true, changed: false, stage: seen };
  if (nextProductionStage(seen) !== to) return { ok: false, error: "not_allowed" };
  if (!["paid", "processing", "shipped"].includes(order.status)) return { ok: false, error: "not_paid" };

  const provider = getShippingProvider();
  let booked: { courierName: string; awb: string } | null = null;
  if (to === "dispatched") {
    if (!provider.isAvailable()) return { ok: false, error: "shipping_off" };
    booked = await provider.createShipment({
      orderId: order.id,
      orderNumber: order.number,
      city: order.shipCity,
      state: order.shipState,
      pincode: order.shipPincode,
      units: order.items.reduce((sum, item) => sum + item.quantity, 0),
    });
  }

  try {
    await stageTransaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (current.stage !== from) throw new Stale();
      await moveStage(tx, { orderId, from, to, actor: "admin", actorId, note });
      // Production uses up the components held for the order.
      if (to === "in_production") await consumeBrandOrder(tx, orderId);
      if (to === "dispatched" && booked) {
        await tx.shipment.create({
          data: {
            orderId,
            provider: provider.name,
            courierName: booked.courierName,
            awb: booked.awb,
            status: "shipped",
            events: {
              create: (["created", "packed", "shipped"] as const).map((status) => ({
                status,
                location: simulatedEvent(booked.awb, status, order.shipCity).location,
                actorId,
              })),
            },
          },
        });
      }
      if (to === "delivered") {
        const shipment = await tx.shipment.findUnique({
          where: { orderId },
          select: { id: true, awb: true },
        });
        if (shipment) {
          await tx.shipment.update({ where: { id: shipment.id }, data: { status: "delivered" } });
          await tx.shipmentEvent.createMany({
            data: (["in_transit", "out_for_delivery", "delivered"] as const).map((status) => ({
              shipmentId: shipment.id,
              status,
              location: simulatedEvent(shipment.awb, status, order.shipCity).location,
              actorId,
            })),
          });
        }
      }
      await logAdminAction(tx, {
        actorId,
        action: "brand.stage",
        resource: "Order",
        resourceId: orderId,
        changes: { stage: { from, to } },
        note,
      });
    });
  } catch (error) {
    // A spare booking (two clicks at once, or refused): call it off.
    if (booked) {
      await provider.cancelShipment(booked.awb).catch((cancelError: unknown) => {
        console.error("advanceProduction: spare booking not cancelled.", cancelError);
      });
    }
    if (error instanceof Stale || isUniqueClash(error)) {
      const now = await db.brandOrderDetails.findUniqueOrThrow({
        where: { orderId },
        select: { stage: true },
      });
      return { ok: true, changed: false, stage: now.stage };
    }
    return failure(error);
  }
  await notifyQuietly(() => sendStageUpdate(orderId, to));
  return { ok: true, changed: true, stage: to };
}

// ─── Reading ────────────────────────────────────────────────────────────────

/** Everything the proof and production panels show, oldest event first. */
export async function readBrandStages(orderId: string) {
  if (!isOrderId(orderId)) return null;
  const details = await db.brandOrderDetails.findUnique({
    where: { orderId },
    select: {
      stage: true,
      order: {
        select: {
          shipment: { select: { courierName: true, awb: true } },
          payments: { where: { refundedAt: { not: null } }, select: { refundReference: true }, take: 1 },
        },
      },
      proofs: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          fileName: true,
          contentType: true,
          sizeBytes: true,
          note: true,
          status: true,
          comment: true,
          createdAt: true,
          decidedAt: true,
        },
      },
      stageEvents: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          actorKind: true,
          actorId: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });
  return details && { ...details, refund: details.order.payments[0]?.refundReference ?? null };
}

export type BrandStages = NonNullable<Awaited<ReturnType<typeof readBrandStages>>>;

/**
 * A proof's file, if `viewer` may see it: the order's owner, or an admin
 * (checked by the caller). Null otherwise.
 */
export async function brandProofFile(
  orderId: string,
  version: number,
  viewer: { userId: string; isAdmin: boolean },
) {
  if (!isOrderId(orderId) || !Number.isInteger(version) || version < 1) return null;
  const proof = await db.brandProof.findFirst({
    where: {
      orderId,
      version,
      details: { order: { type: "brand", ...(viewer.isAdmin ? {} : { userId: viewer.userId }) } },
    },
    select: { fileKey: true, fileName: true, contentType: true },
  });
  return proof ? { key: proof.fileKey, name: proof.fileName, contentType: proof.contentType } : null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function failure(error: unknown): { ok: false; error: StageError } {
  if (error instanceof Refused) return { ok: false, error: error.code };
  if (error instanceof Stale || isUniqueClash(error)) return { ok: false, error: "not_allowed" };
  throw error;
}

async function notifyQuietly(send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error("brand stages: message not sent.", error);
  }
}
