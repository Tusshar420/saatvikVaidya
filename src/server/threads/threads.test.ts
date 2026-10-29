import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeUser } from "../../../tests/setup/shop";
import { addReply, canWrite, createThread, listThreads, readThread, toggleLike } from "./threads";

// Dr. Talk threads: only approved doctors write, everyone reads, and the
// author always comes from the caller's id.

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
});

afterAll(async () => {
  await clearAuthTables(db);
  await db.$disconnect();
});

const valid = { kind: "question", title: "Dosage of Ashwagandha?", body: "What dose do you use for stress?" };

async function doctor() {
  return makeUser(db, { type: "doctor", verificationStatus: "approved" });
}

describe("who may write", () => {
  it("allows approved doctors only", async () => {
    expect(await canWrite(await doctor())).toBe(true);
    expect(await canWrite(await makeUser(db, { type: "doctor", verificationStatus: "pending" }))).toBe(false);
    expect(await canWrite(await makeUser(db, { type: "customer" }))).toBe(false);
    expect(await canWrite(await makeUser(db, { type: "pharmacy", verificationStatus: "approved" }))).toBe(false);
    expect(await canWrite("no-such-user")).toBe(false);
  });

  it("refuses threads, replies and likes from everyone else", async () => {
    const author = await doctor();
    const created = await createThread(author, valid);
    if (!created.ok) throw new Error("setup failed");
    const customer = await makeUser(db, { type: "customer" });
    expect(await createThread(customer, valid)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await addReply(customer, created.id, { body: "hi" })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await toggleLike(customer, created.id)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await db.thread.count()).toBe(1);
  });
});

describe("threads", () => {
  it("validates input", async () => {
    const id = await doctor();
    const bad = await createThread(id, { kind: "gossip", title: "x", body: "short" });
    expect(bad).toMatchObject({ ok: false, error: "invalid" });
    if (!bad.ok) expect(Object.keys(bad.fieldErrors ?? {}).sort()).toEqual(["body", "kind", "title"]);
    expect(await db.thread.count()).toBe(0);
  });

  it("lists newest first, filters by type, and hides hidden threads", async () => {
    const id = await doctor();
    const a = await createThread(id, valid);
    const b = await createThread(id, { ...valid, kind: "case_discussion", title: "A case of migraine" });
    const c = await createThread(id, { ...valid, title: "Hidden one" });
    if (!a.ok || !b.ok || !c.ok) throw new Error("setup failed");
    await db.thread.update({ where: { id: c.id }, data: { hidden: true } });
    const reader = await makeUser(db, { type: "customer" });
    expect((await listThreads(reader, "latest")).map((t) => t.id)).toEqual([b.id, a.id]);
    expect((await listThreads(reader, "case_discussion")).map((t) => t.id)).toEqual([b.id]);
    expect(await readThread(reader, c.id)).toBeNull();
  });

  it("counts replies and toggles one like per doctor", async () => {
    const author = await doctor();
    const other = await doctor();
    const created = await createThread(author, valid);
    if (!created.ok) throw new Error("setup failed");
    expect(await addReply(other, created.id, { body: "  Try 300 mg.  " })).toEqual({ ok: true });
    expect(await addReply(other, created.id, { body: "   " })).toMatchObject({ ok: false, error: "invalid" });
    expect(await addReply(other, 999_999, { body: "hello" })).toMatchObject({ ok: false, error: "notFound" });
    expect(await toggleLike(other, created.id)).toEqual({ ok: true, liked: true });
    const liked = await readThread(other, created.id);
    expect(liked?.thread).toMatchObject({ replyCount: 1, likeCount: 1, likedByMe: true });
    expect(liked?.replies[0]).toMatchObject({ body: "Try 300 mg.", author: { isDoctor: true } });
    expect((await readThread(author, created.id))?.thread.likedByMe).toBe(false);
    expect(await toggleLike(other, created.id)).toEqual({ ok: true, liked: false });
    expect((await readThread(other, created.id))?.thread.likeCount).toBe(0);
  });
});
