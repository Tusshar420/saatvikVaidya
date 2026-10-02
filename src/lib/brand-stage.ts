// The proof and production stages of a paid brand order (docs/CHUNKS.md,
// P2.2) and which stage may follow which. One table, used by the server
// (src/server/brand/stages.ts) and by the pages that show or offer a step.
// Kept free of server imports so client components can use it.

export const brandStages = [
  "awaiting_proof",
  "proof_sent",
  "changes_requested",
  "proof_approved",
  "in_production",
  "quality_check",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

export type BrandStageKey = (typeof brandStages)[number];

/** Who makes a change: the team, the customer, or the system itself. */
export type StageActor = "admin" | "customer" | "system";

export const brandStageTransitions: Record<BrandStageKey, readonly BrandStageKey[]> = {
  awaiting_proof: ["proof_sent", "cancelled"],
  proof_sent: ["proof_approved", "changes_requested", "cancelled"],
  changes_requested: ["proof_sent", "cancelled"],
  proof_approved: ["in_production", "cancelled"],
  in_production: ["quality_check"],
  quality_check: ["dispatched"],
  dispatched: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Who may make each change. The customer only decides on a proof. */
export const brandStageActors: Partial<Record<BrandStageKey, readonly StageActor[]>> = {
  proof_approved: ["customer"],
  changes_requested: ["customer"],
};

export function canMoveBrandStage(from: BrandStageKey, to: BrandStageKey): boolean {
  return brandStageTransitions[from].includes(to);
}

/** Whether `actor` may move an order into `to` (on top of `canMoveBrandStage`). */
export function actorMayMoveTo(actor: StageActor, to: BrandStageKey): boolean {
  const allowed = brandStageActors[to];
  if (allowed) return allowed.includes(actor);
  // Everything else is the team's (or the system's) to do.
  return actor !== "customer";
}

/** Cancelling is allowed until production starts. */
export function canCancelBrandStage(stage: BrandStageKey): boolean {
  return canMoveBrandStage(stage, "cancelled");
}

/** Stages in which the team may upload a new proof. */
export function canUploadProof(stage: BrandStageKey): boolean {
  return canMoveBrandStage(stage, "proof_sent");
}

/** The step the team takes next in production, or null while a proof is in play. */
export function nextProductionStage(stage: BrandStageKey): BrandStageKey | null {
  switch (stage) {
    case "proof_approved":
      return "in_production";
    case "in_production":
      return "quality_check";
    case "quality_check":
      return "dispatched";
    case "dispatched":
      return "delivered";
    default:
      return null;
  }
}

/** The order status (src/lib/orders) that goes with a stage of a paid order. */
export function orderStatusForBrandStage(
  stage: BrandStageKey,
): "paid" | "processing" | "shipped" | "delivered" | "cancelled" {
  switch (stage) {
    case "awaiting_proof":
    case "proof_sent":
    case "changes_requested":
    case "proof_approved":
      return "paid";
    case "in_production":
    case "quality_check":
      return "processing";
    case "dispatched":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
  }
}

/** Proof files: PDF or an image, up to 10 MB. Type is checked from the bytes. */
export const brandProofUpload = {
  maxBytes: 10 * 1024 * 1024,
  types: {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
  },
  accept: ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg",
} as const;

export const proofNoteMax = 500;
export const proofCommentMax = 1000;
export const stageNoteMax = 1000;

/**
 * The customer's four steps: Confirmed, Production, Quality check, Dispatch.
 * Returns the index of the active step (4 once everything is done); 0 for
 * -1 for an order that isn't paid yet.
 */
export function customerStepIndex(stage: BrandStageKey, paid: boolean): number {
  if (!paid) return -1;
  switch (stage) {
    case "awaiting_proof":
    case "proof_sent":
    case "changes_requested":
    case "proof_approved":
      return 0;
    case "in_production":
      return 1;
    case "quality_check":
      return 2;
    case "dispatched":
      return 3;
    case "delivered":
      return 4;
    case "cancelled":
      return -1;
  }
}
