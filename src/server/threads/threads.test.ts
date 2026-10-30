import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeUser } from "../../../tests/setup/shop";
import { addReply, canWrite, createThread, listThreads, readThread, toggleLike, votePoll } from "./threads";

// Dr. Talk threads: only approved doctors post and reply, everyone reads and
// likes, and the author always comes from the caller's id.

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

  it("refuses threads and replies from everyone else", async () => {
    const author = await doctor();
    const created = await createThread(author, valid);
    if (!created.ok) throw new Error("setup failed");
    const customer = await makeUser(db, { type: "customer" });
    expect(await createThread(customer, valid)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await addReply(customer, created.id, { body: "hi" })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await db.thread.count()).toBe(1);
  });

  it("lets every member like, but not unknown users", async () => {
    const author = await doctor();
    const created = await createThread(author, valid);
    if (!created.ok) throw new Error("setup failed");
    const members = [
      await makeUser(db, { type: "customer" }),
      await makeUser(db, { type: "pharmacy", verificationStatus: "approved" }),
      await makeUser(db, { type: "doctor", verificationStatus: "pending" }),
    ];
    for (const id of members) expect(await toggleLike(id, created.id)).toEqual({ ok: true, liked: true });
    expect((await readThread(members[0], created.id))?.thread).toMatchObject({ likeCount: 3, likedByMe: true });
    expect(await toggleLike(members[0], created.id)).toEqual({ ok: true, liked: false });
    expect(await toggleLike("no-such-user", created.id)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await toggleLike(members[0], 999_999)).toMatchObject({ ok: false, error: "notFound" });
    expect(await db.threadLike.count()).toBe(2);
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

describe("polls", () => {
  const withPoll = (pollOptions: string[]) => ({ ...valid, pollOptions });

  it("saves 2 to 6 distinct choices in order and drops blank ones", async () => {
    const id = await doctor();
    const created = await createThread(id, withPoll(["300 mg", " ", "500 mg ", "", "1 g", ""]));
    if (!created.ok) throw new Error("setup failed");
    const poll = (await readThread(id, created.id))?.thread.poll;
    expect(poll?.options.map((o) => o.label)).toEqual(["300 mg", "500 mg", "1 g"]);
    expect(poll).toMatchObject({ totalVotes: 0, myOptionId: null, showResults: true });
    const plain = await createThread(id, valid);
    if (!plain.ok) throw new Error("setup failed");
    expect((await readThread(id, plain.id))?.thread.poll).toBeNull();
  });

  it("refuses too few, too many, too long or repeated choices", async () => {
    const id = await doctor();
    for (const options of [["Only one", "  "], ["a", "b", "c", "d", "e", "f", "g"], ["a", "x".repeat(121)], ["Yes", "yes"]]) {
      const result = await createThread(id, withPoll(options));
      expect(result).toMatchObject({ ok: false, error: "invalid" });
      if (!result.ok) expect(Object.keys(result.fieldErrors ?? {})).toEqual(["pollOptions"]);
    }
    expect(await db.thread.count()).toBe(0);
  });

  it("gives every member one vote that moves or is removed", async () => {
    const author = await doctor();
    const created = await createThread(author, withPoll(["Yes", "No"]));
    if (!created.ok) throw new Error("setup failed");
    const [yes, no] = (await readThread(author, created.id))!.thread.poll!.options;
    const customer = await makeUser(db, { type: "customer" });
    const other = await doctor();

    const before = (await readThread(customer, created.id))?.thread.poll;
    expect(before).toMatchObject({ myOptionId: null, showResults: false });
    expect(await votePoll(customer, created.id, yes.id)).toEqual({ ok: true, optionId: yes.id });
    expect(await votePoll(other, created.id, yes.id)).toEqual({ ok: true, optionId: yes.id });
    expect(await votePoll(customer, created.id, no.id)).toEqual({ ok: true, optionId: no.id });
    const after = (await readThread(customer, created.id))?.thread.poll;
    expect(after).toMatchObject({ totalVotes: 2, myOptionId: no.id, showResults: true });
    expect(after?.options.map((o) => o.votes)).toEqual([1, 1]);

    expect(await votePoll(customer, created.id, no.id)).toEqual({ ok: true, optionId: null });
    expect((await readThread(customer, created.id))?.thread.poll).toMatchObject({ totalVotes: 1, myOptionId: null });
    expect(await db.threadPollVote.count()).toBe(1);
  });

  it("refuses unknown users, choices from another thread and hidden threads", async () => {
    const author = await doctor();
    const a = await createThread(author, withPoll(["Yes", "No"]));
    const b = await createThread(author, withPoll(["Up", "Down"]));
    if (!a.ok || !b.ok) throw new Error("setup failed");
    const otherOption = (await readThread(author, b.id))!.thread.poll!.options[0];
    const voter = await makeUser(db, { type: "customer" });
    expect(await votePoll("no-such-user", b.id, otherOption.id)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await votePoll(voter, a.id, otherOption.id)).toMatchObject({ ok: false, error: "notFound" });
    await db.thread.update({ where: { id: b.id }, data: { hidden: true } });
    expect(await votePoll(voter, b.id, otherOption.id)).toMatchObject({ ok: false, error: "notFound" });
    expect(await db.threadPollVote.count()).toBe(0);
  });
});
