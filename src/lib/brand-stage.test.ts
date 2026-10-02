import { describe, expect, it } from "vitest";
import {
  actorMayMoveTo,
  brandStages,
  brandStageTransitions,
  canCancelBrandStage,
  canMoveBrandStage,
  canUploadProof,
  customerStepIndex,
  nextProductionStage,
  orderStatusForBrandStage,
} from "./brand-stage";

describe("brand stage rules", () => {
  it("lists every stage in the table, and only known stages follow", () => {
    expect(Object.keys(brandStageTransitions).sort()).toEqual([...brandStages].sort());
    for (const targets of Object.values(brandStageTransitions)) {
      for (const target of targets) expect(brandStages).toContain(target);
    }
  });

  it("follows the proof then production order, with no skipping", () => {
    expect(canMoveBrandStage("awaiting_proof", "proof_sent")).toBe(true);
    expect(canMoveBrandStage("awaiting_proof", "in_production")).toBe(false);
    expect(canMoveBrandStage("proof_sent", "proof_approved")).toBe(true);
    expect(canMoveBrandStage("proof_sent", "in_production")).toBe(false);
    expect(canMoveBrandStage("changes_requested", "proof_sent")).toBe(true);
    expect(canMoveBrandStage("changes_requested", "proof_approved")).toBe(false);
    expect(canMoveBrandStage("proof_approved", "in_production")).toBe(true);
    expect(canMoveBrandStage("in_production", "dispatched")).toBe(false);
    expect(canMoveBrandStage("quality_check", "dispatched")).toBe(true);
    expect(canMoveBrandStage("dispatched", "delivered")).toBe(true);
  });

  it("never moves back, and ends at delivered or cancelled", () => {
    expect(canMoveBrandStage("in_production", "proof_approved")).toBe(false);
    expect(canMoveBrandStage("delivered", "in_production")).toBe(false);
    expect(brandStageTransitions.delivered).toEqual([]);
    expect(brandStageTransitions.cancelled).toEqual([]);
  });

  it("allows cancelling only before production", () => {
    for (const stage of ["awaiting_proof", "proof_sent", "changes_requested", "proof_approved"] as const) {
      expect(canCancelBrandStage(stage)).toBe(true);
    }
    for (const stage of ["in_production", "quality_check", "dispatched", "delivered", "cancelled"] as const) {
      expect(canCancelBrandStage(stage)).toBe(false);
    }
  });

  it("lets the team upload a proof only when one is wanted", () => {
    expect(canUploadProof("awaiting_proof")).toBe(true);
    expect(canUploadProof("changes_requested")).toBe(true);
    expect(canUploadProof("proof_approved")).toBe(false);
    expect(canUploadProof("in_production")).toBe(false);
  });

  it("gives the proof decision to the customer, and everything else to the team", () => {
    expect(actorMayMoveTo("customer", "proof_approved")).toBe(true);
    expect(actorMayMoveTo("customer", "changes_requested")).toBe(true);
    expect(actorMayMoveTo("admin", "proof_approved")).toBe(false);
    expect(actorMayMoveTo("admin", "changes_requested")).toBe(false);
    expect(actorMayMoveTo("customer", "in_production")).toBe(false);
    expect(actorMayMoveTo("customer", "cancelled")).toBe(false);
    expect(actorMayMoveTo("admin", "in_production")).toBe(true);
    expect(actorMayMoveTo("admin", "proof_sent")).toBe(true);
  });

  it("names the next production step", () => {
    expect(nextProductionStage("proof_approved")).toBe("in_production");
    expect(nextProductionStage("in_production")).toBe("quality_check");
    expect(nextProductionStage("quality_check")).toBe("dispatched");
    expect(nextProductionStage("dispatched")).toBe("delivered");
    expect(nextProductionStage("proof_sent")).toBeNull();
    expect(nextProductionStage("delivered")).toBeNull();
  });

  it("keeps the order status in step", () => {
    expect(orderStatusForBrandStage("proof_sent")).toBe("paid");
    expect(orderStatusForBrandStage("in_production")).toBe("processing");
    expect(orderStatusForBrandStage("quality_check")).toBe("processing");
    expect(orderStatusForBrandStage("dispatched")).toBe("shipped");
    expect(orderStatusForBrandStage("delivered")).toBe("delivered");
    expect(orderStatusForBrandStage("cancelled")).toBe("cancelled");
  });

  it("maps stages onto the customer's four steps", () => {
    expect(customerStepIndex("awaiting_proof", false)).toBe(-1);
    expect(customerStepIndex("proof_sent", true)).toBe(0);
    expect(customerStepIndex("in_production", true)).toBe(1);
    expect(customerStepIndex("quality_check", true)).toBe(2);
    expect(customerStepIndex("dispatched", true)).toBe(3);
    expect(customerStepIndex("delivered", true)).toBe(4);
  });
});
