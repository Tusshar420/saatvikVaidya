import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addCourseToCart, readCart, type CartOwner } from "@/server/cart/cart";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { placeOrder } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import type { PricingViewer } from "@/server/pricing/rules";
import { seedDatabase } from "@/server/seed";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeUser, validAddress } from "../../../tests/setup/shop";
import {
  deleteDoctorCourse,
  doctorCourseSchema,
  enrolledCourseIds,
  listDoctorCourses,
  listMyEnrolments,
  readCoursePage,
  reviewCourse,
  saveDoctorCourse,
} from "./courses";

// Buying courses (B1) and doctors' own courses (B2): staff review before a
// doctor's course is listed, a seat in the cart, and enrolment once paid.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const customer: PricingViewer = { kind: "customer", professional: false, bulk: false };

const courseForm = {
  title: "T Panchakarma basics",
  tag: "Panchakarma",
  body: "Six live sessions on the basics.",
  details: "Week by week.",
  format: "Live online, 6 sessions",
  duration: "6 weeks",
  price: "1,499",
  videoUrl: "",
  accessDetails: "Zoom link: https://example.test/join",
};

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

let sent: Message[];

beforeEach(async () => {
  await clearAuthTables(db);
  await db.courseTeaser.deleteMany({ where: { OR: [{ authorId: { not: null } }, { key: { startsWith: "t-" } }] } });
  sent = captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

async function approvedDoctor() {
  const id = await makeUser(db, { type: "doctor", verificationStatus: "approved" });
  const { name } = await db.user.findUniqueOrThrow({ where: { id }, select: { name: true } });
  return { id, name };
}

/** A doctor's course, approved by staff (so it's listed and on sale). */
async function listedCourse(form: Record<string, string> = courseForm) {
  const doctor = await approvedDoctor();
  const admin = await makeAdmin(db);
  const saved = await saveDoctorCourse(doctor, null, form);
  if (!saved.ok) throw new Error(`not saved: ${saved.error}`);
  expect(await reviewCourse(admin, saved.id, { decision: "approve" })).toEqual({ ok: true });
  const course = await db.courseTeaser.findUniqueOrThrow({ where: { id: saved.id } });
  return { doctor, admin, course };
}

/** A buyer with an address and the course in their cart. */
async function buyer(courseId: number) {
  const userId = await makeUser(db, { type: "customer" });
  const parsed = parseAddress(validAddress);
  if (!parsed.success) throw new Error("fixture should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  const owner: CartOwner = { kind: "user", userId };
  const added = await addCourseToCart(owner, courseId);
  if (!added.ok) throw new Error(`not added: ${JSON.stringify(added.error)}`);
  return { userId, addressId: address.id, owner };
}

async function buyAndPay(who: Awaited<ReturnType<typeof buyer>>) {
  const cart = await readCart(who.owner, customer, shipping);
  const placed = await placeOrder({
    userId: who.userId,
    viewer: customer,
    addressId: who.addressId,
    checkoutKey: randomUUID(),
    expectedTotalPaise: cart.totals.totalPaise,
    shipping,
  });
  if (!placed.ok) throw new Error(`order refused: ${placed.error}`);
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: placed.orderId, status: "created" } });
  await completePayment({ reference: payment.reference, outcome: "succeeded" });
  return placed.orderId;
}

describe("the doctor's course form", () => {
  it("reads the price in rupees, and a blank price means not sold online", () => {
    const priced = doctorCourseSchema.parse(courseForm);
    expect(priced).toMatchObject({ pricePaise: 149_900, metaValue: "Live online, 6 sessions", videoUrl: null });
    expect(doctorCourseSchema.parse({ ...courseForm, price: "" }).pricePaise).toBeNull();
    for (const price of ["0", "-5", "abc", "500001"]) {
      expect(doctorCourseSchema.safeParse({ ...courseForm, price }).success).toBe(false);
    }
    expect(doctorCourseSchema.safeParse({ ...courseForm, title: "" }).success).toBe(false);
    expect(doctorCourseSchema.safeParse({ ...courseForm, videoUrl: "https://example.test/v" }).success).toBe(false);
  });
});

describe("doctors' courses and staff review", () => {
  it("only approved doctors can create courses", async () => {
    for (const options of [
      { type: "customer" },
      { type: "doctor", verificationStatus: "pending" as const },
      { type: "pharmacy", verificationStatus: "approved" as const },
    ]) {
      const id = await makeUser(db, options);
      expect(await saveDoctorCourse({ id, name: "X" }, null, courseForm)).toMatchObject({ ok: false });
    }
    expect(await db.courseTeaser.count({ where: { authorId: { not: null } } })).toBe(0);
  });

  it("a new course waits for review, unlisted, and staff are told", async () => {
    const doctor = await approvedDoctor();
    const admin = await makeAdmin(db);
    await db.user.update({ where: { id: admin }, data: { adminRole: "content" } });
    const saved = await saveDoctorCourse(doctor, null, courseForm);
    if (!saved.ok) throw new Error("not saved");

    const row = await db.courseTeaser.findUniqueOrThrow({ where: { id: saved.id } });
    expect(row).toMatchObject({ status: "pending", authorId: doctor.id, instructor: doctor.name, pricePaise: 149_900 });
    expect(row.key).toMatch(/^t-panchakarma-basics-[0-9a-f]{6}$/);
    expect(await db.notification.findMany({ where: { userId: admin }, select: { kind: true, href: true } })).toEqual([
      { kind: "admin", href: `/admin/content/courses/${saved.id}/edit` },
    ]);
    // Not public yet; the author and staff can preview it.
    expect(await readCoursePage(row.key, null)).toBeNull();
    expect(await readCoursePage(row.key, { id: doctor.id, role: "user" })).toMatchObject({ preview: true, isAuthor: true });
    expect(await readCoursePage(row.key, { id: admin, role: "admin" })).toMatchObject({ preview: true });
    // And it can't be bought.
    const owner: CartOwner = { kind: "user", userId: await makeUser(db) };
    expect(await addCourseToCart(owner, saved.id)).toEqual({ ok: false, error: { kind: "unavailable" } });
  });

  it("sending a course back needs a note, which the doctor sees", async () => {
    const doctor = await approvedDoctor();
    const admin = await makeAdmin(db);
    const saved = await saveDoctorCourse(doctor, null, courseForm);
    if (!saved.ok) throw new Error("not saved");

    expect(await reviewCourse(admin, saved.id, { decision: "reject", note: "  " })).toMatchObject({ ok: false });
    expect(await reviewCourse(admin, saved.id, { decision: "reject", note: "Add the schedule." })).toEqual({ ok: true });
    expect(await listDoctorCourses(doctor.id)).toMatchObject([
      { id: saved.id, status: "rejected", reviewNote: "Add the schedule.", enrolments: 0 },
    ]);
    expect(await db.notification.findFirst({ where: { userId: doctor.id } })).toMatchObject({
      kind: "course",
      body: "Add the schedule.",
      href: "/doctor/courses",
    });
    expect(await db.adminLog.count({ where: { action: "course.review", resourceId: String(saved.id) } })).toBe(1);
  });

  it("emails the content team a course to review, then the doctor the decision", async () => {
    const doctor = await approvedDoctor();
    const admin = await makeAdmin(db);
    await db.user.update({ where: { id: admin }, data: { adminRole: "content" } });
    const emails = await db.user.findMany({ where: { id: { in: [doctor.id, admin] } }, select: { id: true, email: true } });
    const emailOf = (id: string) => emails.find((row) => row.id === id)!.email;
    const saved = await saveDoctorCourse(doctor, null, courseForm);
    if (!saved.ok) throw new Error("not saved");
    const toTeam = sent.find((message) => message.channel === "email" && message.to === emailOf(admin));
    expect(toTeam?.channel === "email" && toTeam.text).toContain(`/admin/content/courses/${saved.id}/edit`);

    sent.length = 0;
    expect(await reviewCourse(admin, saved.id, { decision: "reject", note: "Add the schedule." })).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: "email", to: emailOf(doctor.id), subject: "Your course needs a few changes: T Panchakarma basics" });
    expect(sent[0]?.channel === "email" && sent[0].text).toContain("Add the schedule.");

    sent.length = 0;
    expect(await reviewCourse(admin, saved.id, { decision: "approve" })).toEqual({ ok: true });
    expect(sent[0]).toMatchObject({ to: emailOf(doctor.id), subject: "Your course is live: T Panchakarma basics" });
  });

  it("approving lists it; an edit sends it back for review; other doctors can't touch it", async () => {
    const { doctor, course } = await listedCourse();
    expect(await readCoursePage(course.key, null)).toMatchObject({ forSale: true, preview: false, accessDetails: null });

    const other = await approvedDoctor();
    expect(await saveDoctorCourse(other, course.id, courseForm)).toMatchObject({ ok: false });
    expect(await deleteDoctorCourse(other.id, course.id)).toMatchObject({ ok: false });

    expect(await saveDoctorCourse(doctor, course.id, { ...courseForm, title: "T New title" })).toEqual({
      ok: true,
      id: course.id,
    });
    const edited = await db.courseTeaser.findUniqueOrThrow({ where: { id: course.id } });
    expect(edited).toMatchObject({ title: "T New title", status: "pending", key: course.key });
    expect(await readCoursePage(course.key, null)).toBeNull();
  });
});

describe("buying a course", () => {
  it("an order paid by QR shows as waiting for payment until staff confirm it", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "manual");
    const { course } = await listedCourse();
    const who = await buyer(course.id);
    const viewer = { id: who.userId, role: "user" };
    expect(await readCoursePage(course.key, viewer)).toMatchObject({ awaitingPaymentOrderId: null });
    const cart = await readCart(who.owner, customer, shipping);
    const placed = await placeOrder({
      userId: who.userId,
      viewer: customer,
      addressId: who.addressId,
      checkoutKey: randomUUID(),
      expectedTotalPaise: cart.totals.totalPaise,
      shipping,
    });
    if (!placed.ok) throw new Error(`order refused: ${placed.error}`);
    expect(await readCoursePage(course.key, viewer)).toMatchObject({
      enrolled: false,
      awaitingPaymentOrderId: placed.orderId,
      accessDetails: null,
    });
    // Nobody else sees it as theirs.
    expect(await readCoursePage(course.key, null)).toMatchObject({ awaitingPaymentOrderId: null });

    const payment = await db.payment.findFirstOrThrow({ where: { orderId: placed.orderId, status: "created" } });
    await completePayment({ reference: payment.reference, outcome: "succeeded" });
    expect(await readCoursePage(course.key, viewer)).toMatchObject({ enrolled: true, awaitingPaymentOrderId: null });
  });

  it("a paid order enrols the buyer: joining details, My courses, notifications, GST line", async () => {
    const { doctor, course } = await listedCourse();
    const who = await buyer(course.id);
    const cart = await readCart(who.owner, customer, shipping);
    expect(cart.courses).toMatchObject([{ courseId: course.id, lineTotalPaise: 149_900, issue: null }]);
    // Nothing to deliver: no delivery charge.
    expect(cart.totals).toMatchObject({ shippingPaise: 0, totalPaise: 149_900 });
    expect(await readCoursePage(course.key, { id: who.userId, role: "user" })).toMatchObject({
      enrolled: false,
      accessDetails: null,
    });

    const orderId = await buyAndPay(who);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, invoices: true } });
    expect(order.status).toBe("paid");
    expect(order.items).toMatchObject([
      { kind: "course", courseId: course.id, hsnCode: "999293", gstRate: 18, quantity: 1, lineTotalPaise: 149_900 },
    ]);
    expect(order.invoices).toHaveLength(1);
    expect(await enrolledCourseIds(who.userId)).toEqual(new Set([course.id]));
    expect(await readCoursePage(course.key, { id: who.userId, role: "user" })).toMatchObject({
      enrolled: true,
      accessDetails: courseForm.accessDetails,
    });
    expect(await listMyEnrolments(who.userId)).toMatchObject([{ key: course.key, title: course.title }]);
    // The cart is empty again.
    expect((await readCart(who.owner, customer, shipping)).courses).toEqual([]);
    // The buyer is told how to join; the doctor about the enrolment.
    const notes = await db.notification.findMany({
      where: { kind: "course", userId: { in: [who.userId, doctor.id] } },
      select: { userId: true, href: true },
    });
    expect(notes).toEqual(
      expect.arrayContaining([
        { userId: who.userId, href: `/courses/${course.key}` },
        { userId: doctor.id, href: "/doctor/courses" },
      ]),
    );
    expect((await listDoctorCourses(doctor.id))[0]!.enrolments).toBe(1);
    // Enrolled: it can't be bought again or deleted by the doctor.
    expect(await addCourseToCart(who.owner, course.id)).toEqual({ ok: false, error: { kind: "enrolled" } });
    expect(await deleteDoctorCourse(doctor.id, course.id)).toMatchObject({ ok: false });
    // Hidden later, the buyer keeps the page.
    await db.courseTeaser.update({ where: { id: course.id }, data: { active: false } });
    expect(await readCoursePage(course.key, null)).toBeNull();
    expect(await readCoursePage(course.key, { id: who.userId, role: "user" })).toMatchObject({ enrolled: true });
  });

  it("an unpaid or cancelled order doesn't enrol", async () => {
    const { course } = await listedCourse();
    const who = await buyer(course.id);
    const cart = await readCart(who.owner, customer, shipping);
    const placed = await placeOrder({
      userId: who.userId,
      viewer: customer,
      addressId: who.addressId,
      checkoutKey: randomUUID(),
      expectedTotalPaise: cart.totals.totalPaise,
      shipping,
    });
    if (!placed.ok) throw new Error("order refused");
    expect(await enrolledCourseIds(who.userId)).toEqual(new Set());
    await db.order.update({ where: { id: placed.orderId }, data: { status: "cancelled", paidAt: new Date() } });
    expect(await enrolledCourseIds(who.userId)).toEqual(new Set());
  });

  it("a course taken off sale while in the cart blocks checkout", async () => {
    const { course } = await listedCourse();
    const who = await buyer(course.id);
    const before = await readCart(who.owner, customer, shipping);
    await db.courseTeaser.update({ where: { id: course.id }, data: { pricePaise: null } });
    const cart = await readCart(who.owner, customer, shipping);
    expect(cart.courses[0]!.issue).toEqual({ kind: "unavailable" });
    expect(cart.hasIssues).toBe(true);
    const placed = await placeOrder({
      userId: who.userId,
      viewer: customer,
      addressId: who.addressId,
      checkoutKey: randomUUID(),
      expectedTotalPaise: before.totals.totalPaise,
      shipping,
    });
    expect(placed).toEqual({ ok: false, error: "cart_changed" });
  });
});
