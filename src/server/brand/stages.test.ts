import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelOrder } from "@/server/admin/orders";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import { seedDatabase } from "@/server/seed";
import { createShipment, simulateShipmentStep } from "@/server/shipping/shipments";
import { getStorage } from "@/server/storage";
import { captureMessages } from "../../../tests/setup/auth";
import { makeBrandOrder, pdfBytes, pngBytes } from "../../../tests/setup/brand";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeUser } from "../../../tests/setup/shop";
import {
  advanceProduction,
  brandProofFile,
  decideProof,
  readBrandStages,
  uploadProof,
} from "./stages";

// Build Your Brand label proof and production (P2.2): the stage rules on
// the server, proof versions and who can see them, the customer's decision,
// the production steps with the test shipping provider, and cancelling with
// a test refund.

let sent: Message[];

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  sent = captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

async function setup() {
  const order = await makeBrandOrder(db);
  const adminId = await makeAdmin(db);
  await db.user.update({ where: { id: adminId }, data: { adminRole: "orders" } });
  sent.length = 0;
  return { ...order, adminId };
}

const send = (ctx: { adminId: string; orderId: string }, bytes = pngBytes(), note: string | null = null) =>
  uploadProof({ actorId: ctx.adminId, orderId: ctx.orderId, fileName: "proof.png", bytes, note });

const stageOf = async (orderId: string) =>
  (await db.brandOrderDetails.findUniqueOrThrow({ where: { orderId } })).stage;

/** A paid order taken to an approved proof. */
async function approved() {
  const ctx = await setup();
  const proof = await send(ctx);
  expect(proof.ok).toBe(true);
  const row = await db.brandProof.findFirstOrThrow({ where: { orderId: ctx.orderId } });
  expect(
    await decideProof({ userId: ctx.userId, orderId: ctx.orderId, proofId: row.id, decision: "approve" }),
  ).toMatchObject({ ok: true });
  return ctx;
}

const advance = (
  ctx: { adminId: string; orderId: string },
  from: Parameters<typeof advanceProduction>[0]["from"],
  to: Parameters<typeof advanceProduction>[0]["to"],
) => advanceProduction({ actorId: ctx.adminId, orderId: ctx.orderId, from, to });

describe("after payment", () => {
  it("waits for a proof, with the opening event logged", async () => {
    const ctx = await setup();
    expect(await stageOf(ctx.orderId)).toBe("awaiting_proof");
    const stages = await readBrandStages(ctx.orderId);
    expect(stages?.stageEvents).toMatchObject([{ fromStage: null, toStage: "awaiting_proof", actorKind: "system" }]);
  });

  it("does not start the stages for an unpaid order", async () => {
    const order = await makeBrandOrder(db, { pay: false });
    const admin = await makeAdmin(db);
    expect(
      await uploadProof({ actorId: admin, orderId: order.orderId, fileName: "p.png", bytes: pngBytes() }),
    ).toEqual({ ok: false, error: "not_paid" });
  });
});

describe("sending proofs", () => {
  it("checks the file from its bytes and size, and keeps nothing when refused", async () => {
    const ctx = await setup();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(await send(ctx, svg)).toEqual({ ok: false, error: "fileType" });
    expect(await send(ctx, new Uint8Array())).toEqual({ ok: false, error: "empty" });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(pngBytes());
    expect(await send(ctx, big)).toEqual({ ok: false, error: "tooLarge" });
    expect(await send(ctx, pngBytes(), "x".repeat(501))).toEqual({ ok: false, error: "invalid" });
    expect(await db.brandProof.count({ where: { orderId: ctx.orderId } })).toBe(0);
    expect(await stageOf(ctx.orderId)).toBe("awaiting_proof");
  });

  it("sends version 1, moves the stage and tells the customer", async () => {
    const ctx = await setup();
    const result = await send(ctx, pdfBytes(), "First draft");
    expect(result).toEqual({ ok: true, changed: true, version: 1 });
    expect(await stageOf(ctx.orderId)).toBe("proof_sent");
    const proof = await db.brandProof.findFirstOrThrow({ where: { orderId: ctx.orderId } });
    expect(proof).toMatchObject({ version: 1, status: "pending", contentType: "application/pdf", note: "First draft" });
    expect(proof.fileKey).toMatch(/^brand-proofs\/.+\.pdf$/);
    expect(await getStorage().get(proof.fileKey)).not.toBeNull();
    const events = (await readBrandStages(ctx.orderId))!.stageEvents;
    expect(events[0]).toMatchObject({ fromStage: "awaiting_proof", toStage: "proof_sent", actorKind: "admin", actorId: ctx.adminId });
    const log = await db.adminLog.findFirst({ where: { action: "brand.proof.upload", resourceId: ctx.orderId } });
    expect(log).not.toBeNull();
    const email = sent.find((message) => message.channel === "email" && /label proof/i.test(message.subject));
    expect(email).toBeDefined();
    expect(email?.channel === "email" && email.text).toContain("First draft");
  });

  it("keeps every version and replaces a proof nobody has decided on", async () => {
    const ctx = await setup();
    await send(ctx);
    expect(await send(ctx)).toEqual({ ok: true, changed: true, version: 2 });
    const proofs = await db.brandProof.findMany({ where: { orderId: ctx.orderId }, orderBy: { version: "asc" } });
    expect(proofs.map((proof) => [proof.version, proof.status])).toEqual([
      [1, "superseded"],
      [2, "pending"],
    ]);
    expect(await stageOf(ctx.orderId)).toBe("proof_sent");
  });

  it("refuses a proof once it is approved or for a store order", async () => {
    const ctx = await approved();
    expect(await send(ctx)).toEqual({ ok: false, error: "not_allowed" });
    const missing = await uploadProof({
      actorId: ctx.adminId,
      orderId: "A".repeat(22),
      fileName: "p.png",
      bytes: pngBytes(),
    });
    expect(missing).toEqual({ ok: false, error: "not_found" });
  });
});

describe("the customer's decision", () => {
  it("lets only the owner decide, and only on the proof that is waiting", async () => {
    const ctx = await setup();
    await send(ctx);
    const proof = await db.brandProof.findFirstOrThrow({ where: { orderId: ctx.orderId } });
    const stranger = await makeUser(db);
    expect(
      await decideProof({ userId: stranger, orderId: ctx.orderId, proofId: proof.id, decision: "approve" }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(await stageOf(ctx.orderId)).toBe("proof_sent");
    // A proof id from another order does nothing.
    const other = await makeBrandOrder(db);
    expect(
      await decideProof({ userId: other.userId, orderId: other.orderId, proofId: proof.id, decision: "approve" }),
    ).toEqual({ ok: false, error: "not_allowed" });
    expect((await db.brandProof.findUniqueOrThrow({ where: { id: proof.id } })).status).toBe("pending");
  });

  it("needs a comment to ask for changes, tells the order admins, and takes a new proof", async () => {
    const ctx = await setup();
    await send(ctx);
    const first = await db.brandProof.findFirstOrThrow({ where: { orderId: ctx.orderId } });
    const decide = (comment?: string) =>
      decideProof({ userId: ctx.userId, orderId: ctx.orderId, proofId: first.id, decision: "changes", comment });
    expect(await decide("")).toEqual({ ok: false, error: "invalid" });
    expect(await decide("x".repeat(1001))).toEqual({ ok: false, error: "invalid" });
    sent.length = 0;
    expect(await decide("Make the logo bigger")).toEqual({ ok: true, changed: true });
    expect(await stageOf(ctx.orderId)).toBe("changes_requested");
    expect(await db.brandProof.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      status: "changes_requested",
      comment: "Make the logo bigger",
    });
    const adminEmail = (await db.user.findUniqueOrThrow({ where: { id: ctx.adminId } })).email;
    const toAdmin = sent.find((message) => message.channel === "email" && message.to === adminEmail);
    expect(toAdmin?.channel === "email" && toAdmin.text).toContain("Make the logo bigger");
    // Deciding again on the same proof does nothing.
    expect(await decide("Again")).toEqual({ ok: false, error: "not_allowed" });

    // A new version goes out, and can be approved.
    expect(await send(ctx)).toMatchObject({ ok: true, version: 2 });
    const second = await db.brandProof.findFirstOrThrow({ where: { orderId: ctx.orderId, version: 2 } });
    // The old proof can't be approved any more.
    expect(
      await decideProof({ userId: ctx.userId, orderId: ctx.orderId, proofId: first.id, decision: "approve" }),
    ).toEqual({ ok: false, error: "not_allowed" });
    expect(
      await decideProof({ userId: ctx.userId, orderId: ctx.orderId, proofId: second.id, decision: "approve" }),
    ).toEqual({ ok: true, changed: true });
    expect(await stageOf(ctx.orderId)).toBe("proof_approved");
  });

  it("applies one approval when two arrive at once", async () => {
    const ctx = await setup();
    await send(ctx);
    const proof = await db.brandProof.findFirstOrThrow({ where: { orderId: ctx.orderId } });
    sent.length = 0;
    const results = await Promise.all([
      decideProof({ userId: ctx.userId, orderId: ctx.orderId, proofId: proof.id, decision: "approve" }),
      decideProof({ userId: ctx.userId, orderId: ctx.orderId, proofId: proof.id, decision: "approve" }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await db.brandStageEvent.count({ where: { orderId: ctx.orderId, toStage: "proof_approved" } })).toBe(1);
  });
});

describe("production", () => {
  it("starts straight from a paid order, without a proof", async () => {
    const ctx = await setup();
    expect(await advance(ctx, "awaiting_proof", "quality_check")).toEqual({ ok: false, error: "not_allowed" });
    expect(await advance(ctx, "awaiting_proof", "in_production")).toEqual({ ok: true, changed: true, stage: "in_production" });
    expect((await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } })).status).toBe("processing");
  });

  it("can also start while a proof is out with the customer", async () => {
    const ctx = await setup();
    await send(ctx);
    expect(await advance(ctx, "proof_sent", "in_production")).toEqual({ ok: true, changed: true, stage: "in_production" });
    expect(await stageOf(ctx.orderId)).toBe("in_production");
  });

  it("goes through each step in order, with the test courier at dispatch", async () => {
    const ctx = await approved();
    sent.length = 0;
    expect(await advance(ctx, "proof_approved", "quality_check")).toEqual({ ok: false, error: "not_allowed" });
    expect(await advance(ctx, "proof_approved", "in_production")).toEqual({ ok: true, changed: true, stage: "in_production" });
    expect((await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } })).status).toBe("processing");
    expect(await advance(ctx, "in_production", "dispatched")).toEqual({ ok: false, error: "not_allowed" });
    expect(await advance(ctx, "in_production", "quality_check")).toMatchObject({ ok: true, stage: "quality_check" });
    expect(await advance(ctx, "quality_check", "dispatched")).toMatchObject({ ok: true, stage: "dispatched" });
    const order = await db.order.findUniqueOrThrow({ where: { id: ctx.orderId }, include: { shipment: { include: { events: true } } } });
    expect(order.status).toBe("shipped");
    expect(order.shipment).toMatchObject({ status: "shipped", provider: "test" });
    expect(order.shipment?.awb).toBeTruthy();
    expect(await advance(ctx, "dispatched", "delivered")).toMatchObject({ ok: true, stage: "delivered" });
    const done = await db.order.findUniqueOrThrow({ where: { id: ctx.orderId }, include: { shipment: true } });
    expect(done.status).toBe("delivered");
    expect(done.shipment?.status).toBe("delivered");
    // No coins for a brand order.
    expect(await db.coinLedger.count({ where: { userId: ctx.userId } })).toBe(0);

    const stages = (await readBrandStages(ctx.orderId))!;
    expect(stages.stageEvents.map((event) => event.toStage).reverse()).toEqual([
      "awaiting_proof",
      "proof_sent",
      "proof_approved",
      "in_production",
      "quality_check",
      "dispatched",
      "delivered",
    ]);
    expect(stages.stageEvents.find((event) => event.toStage === "dispatched")).toMatchObject({
      actorKind: "admin",
      actorId: ctx.adminId,
    });
    // The customer is told at each step; the dispatch message names the courier.
    const emails = sent.filter((message) => message.channel === "email");
    expect(emails).toHaveLength(4);
    expect(emails.some((message) => message.channel === "email" && message.text.includes(order.shipment!.awb))).toBe(true);
  });

  it("applies a step once when the admin double-clicks or two admins click at once", async () => {
    const ctx = await approved();
    const results = await Promise.all([
      advance(ctx, "proof_approved", "in_production"),
      advance(ctx, "proof_approved", "in_production"),
    ]);
    expect(results.filter((result) => result.ok && result.changed)).toHaveLength(1);
    // A click made for a stage the order has left changes nothing.
    expect(await advance(ctx, "proof_approved", "in_production")).toEqual({ ok: true, changed: false, stage: "in_production" });
    expect(await db.brandStageEvent.count({ where: { orderId: ctx.orderId, toStage: "in_production" } })).toBe(1);
  });

  it("books one courier even if dispatch is clicked twice", async () => {
    const ctx = await approved();
    await advance(ctx, "proof_approved", "in_production");
    await advance(ctx, "in_production", "quality_check");
    const results = await Promise.all([
      advance(ctx, "quality_check", "dispatched"),
      advance(ctx, "quality_check", "dispatched"),
    ]);
    expect(results.filter((result) => result.ok && result.changed)).toHaveLength(1);
    expect(await db.shipment.count({ where: { orderId: ctx.orderId } })).toBe(1);
  });

  it("keeps the store's shipment tools away from brand orders", async () => {
    const ctx = await approved();
    expect(await createShipment(ctx.adminId, ctx.orderId)).toEqual({ ok: false, error: "brand_order" });
    await advance(ctx, "proof_approved", "in_production");
    await advance(ctx, "in_production", "quality_check");
    await advance(ctx, "quality_check", "dispatched");
    expect(await simulateShipmentStep(ctx.adminId, ctx.orderId, "next", "shipped")).toEqual({
      ok: false,
      error: "brand_order",
    });
  });
});

describe("cancelling", () => {
  it("before production: cancels the stage and order, refunds through the test provider and issues a credit note", async () => {
    const ctx = await approved();
    sent.length = 0;
    expect(await cancelOrder(ctx.adminId, ctx.orderId, "Customer changed their mind")).toMatchObject({ ok: true, changed: true });
    expect(await stageOf(ctx.orderId)).toBe("cancelled");
    const order = await db.order.findUniqueOrThrow({ where: { id: ctx.orderId }, include: { payments: true, invoices: true } });
    expect(order.status).toBe("cancelled");
    expect(order.payments[0]).toMatchObject({ status: "succeeded" });
    expect(order.payments[0]?.refundReference).toMatch(/^test_refund_/);
    expect(order.payments[0]?.refundedAt).not.toBeNull();
    expect(order.invoices.map((invoice) => invoice.kind).sort()).toEqual(["credit_note", "invoice"]);
    expect(
      (await readBrandStages(ctx.orderId))!.stageEvents[0],
    ).toMatchObject({ toStage: "cancelled", actorKind: "admin", actorId: ctx.adminId, note: "Customer changed their mind" });
    // Cancelling again changes nothing, and a stock-less order puts nothing back.
    expect(await cancelOrder(ctx.adminId, ctx.orderId)).toMatchObject({ ok: true, changed: false });
    expect(await db.payment.count({ where: { orderId: ctx.orderId, refundedAt: { not: null } } })).toBe(1);
    // A cancelled order takes no more proofs or steps.
    expect(await send(ctx)).toEqual({ ok: false, error: "not_allowed" });
    expect(await advance(ctx, "cancelled", "in_production")).toEqual({ ok: false, error: "not_allowed" });
  });

  it("is refused once production has started", async () => {
    const ctx = await approved();
    await advance(ctx, "proof_approved", "in_production");
    expect(await cancelOrder(ctx.adminId, ctx.orderId)).toEqual({ ok: false, error: "not_allowed" });
    expect(await stageOf(ctx.orderId)).toBe("in_production");
    expect((await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } })).status).toBe("processing");
  });

  it("works while a proof is out", async () => {
    const ctx = await setup();
    await send(ctx);
    expect(await cancelOrder(ctx.adminId, ctx.orderId)).toMatchObject({ ok: true, changed: true });
    expect(await stageOf(ctx.orderId)).toBe("cancelled");
  });
});

describe("who can see a proof", () => {
  it("is the owner or an orders admin; anyone else gets nothing", async () => {
    const ctx = await setup();
    await send(ctx);
    const owner = await brandProofFile(ctx.orderId, 1, { userId: ctx.userId, isAdmin: false });
    expect(owner).toMatchObject({ contentType: "image/png", name: "proof.png" });
    expect(await getStorage().get(owner!.key)).not.toBeNull();
    expect(await brandProofFile(ctx.orderId, 1, { userId: "someone-else", isAdmin: false })).toBeNull();
    expect(await brandProofFile(ctx.orderId, 1, { userId: "an-admin", isAdmin: true })).not.toBeNull();
    expect(await brandProofFile(ctx.orderId, 2, { userId: ctx.userId, isAdmin: false })).toBeNull();
    expect(await brandProofFile(ctx.orderId, 0, { userId: ctx.userId, isAdmin: false })).toBeNull();
    expect(await brandProofFile("not-an-id", 1, { userId: ctx.userId, isAdmin: true })).toBeNull();
  });
});
