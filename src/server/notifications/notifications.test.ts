import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { sendProofDecision } from "@/server/notify/brand";
import { sendOrderCancelled, sendOrderConfirmation, sendShipmentUpdate } from "@/server/notify/orders";
import { sendVerificationDecision } from "@/server/notify/verification";
import { seedDatabase } from "@/server/seed";
import { captureMessages } from "../../../tests/setup/auth";
import { makeBrandOrder } from "../../../tests/setup/brand";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { makeUser } from "../../../tests/setup/shop";
import {
  createNotification,
  createNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadBySection,
  unreadCount,
} from "./notifications";

// In-app notifications: saving them safely, the read/unread lists, and that
// every read and write stays inside one user's own notifications. Then the
// events that write them (orders, brand orders, verification).

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

const note = (userId: string, title: string, href = "/orders") =>
  ({ userId, kind: "order", title, body: `About ${title}.`, href }) as const;

describe("section badges", () => {
  it("counts unread notifications per section and drops them once read", async () => {
    const userId = await makeUser(db);
    const other = await makeUser(db);
    const section = (id: string, kind: "course" | "doctor_talk" | "quiz" | "top_brands", title: string) =>
      createNotification({ userId: id, kind, title, body: "", href: "/courses" });
    await section(userId, "course", "New course");
    await section(userId, "course", "Another course");
    await section(userId, "quiz", "Quiz open");
    await section(other, "doctor_talk", "Not yours");
    await createNotification(note(userId, "An order"));
    expect(await unreadBySection(userId)).toEqual({ "/courses": 2, "/quiz": 1 });

    await markAllNotificationsRead(userId);
    expect(await unreadBySection(userId)).toEqual({});
    expect(await unreadBySection(other)).toEqual({ "/doctor-talk": 1 });
  });
});

describe("saving and listing", () => {
  it("lists newest first, filtered all / unread / read, with the unread count", async () => {
    const userId = await makeUser(db);
    await createNotification(note(userId, "First"));
    await createNotification(note(userId, "Second"));
    await createNotification(note(userId, "Third"));
    const [third, second] = await listNotifications(userId);
    expect([third!.title, second!.title]).toEqual(["Third", "Second"]);
    expect(third).toMatchObject({ kind: "order", body: "About Third.", href: "/orders", read: false });
    expect(Number.isNaN(Date.parse(third!.createdAt))).toBe(false);

    expect(await markNotificationRead(userId, second!.id)).toBe(true);
    expect(await unreadCount(userId)).toBe(2);
    expect((await listNotifications(userId, "unread")).map((n) => n.title)).toEqual(["Third", "First"]);
    expect((await listNotifications(userId, "read")).map((n) => n.title)).toEqual(["Second"]);
    expect(await listNotifications(userId, "all")).toHaveLength(3);
    expect(await listNotifications(userId, "all", 2)).toHaveLength(2);
  });

  it("marking read again keeps the first read time", async () => {
    const userId = await makeUser(db);
    await createNotification(note(userId, "Once"));
    const [item] = await listNotifications(userId);
    await markNotificationRead(userId, item!.id);
    const first = (await db.notification.findUniqueOrThrow({ where: { id: item!.id } })).readAt;
    expect(first).not.toBeNull();
    expect(await markNotificationRead(userId, item!.id)).toBe(true);
    const again = (await db.notification.findUniqueOrThrow({ where: { id: item!.id } })).readAt;
    expect(again).toEqual(first);
  });

  it("refuses links that leave the site, and clips long text", async () => {
    const userId = await makeUser(db);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const href of ["https://evil.test/x", "//evil.test", "/\\evil.test", "javascript:alert(1)", "", "orders"]) {
      expect(await createNotification(note(userId, "Bad", href))).toBe(false);
    }
    expect(error).toHaveBeenCalled();
    expect(await unreadCount(userId)).toBe(0);

    expect(await createNotification({ ...note(userId, "x".repeat(400)), body: "y".repeat(900) })).toBe(true);
    const [item] = await listNotifications(userId);
    expect(item!.title).toHaveLength(160);
    expect(item!.title.endsWith("…")).toBe(true);
    expect(item!.body).toHaveLength(500);
  });

  it("never throws, so it can't undo what it reports", async () => {
    const userId = await makeUser(db);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db.notification, "createMany").mockRejectedValueOnce(new Error("database down"));
    expect(await createNotifications([note(userId, "Lost")])).toBe(0);
    expect(error).toHaveBeenCalledOnce();
    expect(await createNotifications([])).toBe(0);
  });
});

describe("only the user's own notifications", () => {
  it("can't read, mark or count someone else's", async () => {
    const mine = await makeUser(db);
    const theirs = await makeUser(db);
    await createNotifications([note(mine, "Mine"), note(theirs, "Theirs"), note(theirs, "Theirs too")]);
    const [their] = await listNotifications(theirs);

    expect((await listNotifications(mine)).map((n) => n.title)).toEqual(["Mine"]);
    expect(await markNotificationRead(mine, their!.id)).toBe(false);
    expect(await markNotificationRead(mine, 2_000_000_000)).toBe(false);
    expect(await unreadCount(theirs)).toBe(2);

    expect(await markAllNotificationsRead(mine)).toBe(1);
    expect(await unreadCount(mine)).toBe(0);
    expect(await unreadCount(theirs)).toBe(2);
  });

  it("go with the account when it is deleted", async () => {
    const userId = await makeUser(db);
    await createNotification(note(userId, "Bye"));
    await db.user.delete({ where: { id: userId } });
    expect(await db.notification.count({ where: { userId } })).toBe(0);
  });
});

describe("events that write notifications", () => {
  it("store order: confirmed, shipment steps and cancelled, each opening the order", async () => {
    const order = await makeOrder(db, { pay: false });
    // Email and SMS off: the in-app notification is still saved.
    await db.user.update({
      where: { id: order.userId },
      data: { notifyOrderEmail: false, notifyOrderSms: false },
    });
    await sendOrderConfirmation(order.orderId);
    await sendShipmentUpdate(order.orderId, "out_for_delivery");
    await sendOrderCancelled(order.orderId);
    const items = await listNotifications(order.userId);
    const number = (await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).number;
    expect(items.map((n) => n.title)).toEqual([
      `Order ${number} cancelled`,
      `Order ${number}: Out for delivery`,
      `Order ${number} confirmed`,
    ]);
    expect(items.every((n) => n.href === `/orders/${order.orderId}` && n.kind === "order" && !n.read)).toBe(true);
  });

  it("brand order: the buyer's opens My Brand; a proof decision reaches orders admins only", async () => {
    const order = await makeBrandOrder(db);
    const [paid] = await listNotifications(order.userId);
    expect(paid).toMatchObject({ kind: "brand", href: `/my-brand/${order.orderId}` });

    const ordersAdmin = await makeAdmin(db);
    await db.user.update({ where: { id: ordersAdmin }, data: { adminRole: "orders" } });
    const contentAdmin = await makeAdmin(db);
    await db.user.update({ where: { id: contentAdmin }, data: { adminRole: "content" } });

    await sendProofDecision(order.orderId, "changes", 1, "Bigger logo");
    const [decision] = await listNotifications(ordersAdmin);
    expect(decision).toMatchObject({ kind: "admin", href: `/admin/brand-orders/${order.orderId}` });
    expect(decision!.body).toContain("Bigger logo");
    expect(await listNotifications(contentAdmin)).toHaveLength(0);
  });

  it("verification decision opens My account", async () => {
    const userId = await makeUser(db, { type: "doctor" });
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, phoneNumber: true },
    });
    await sendVerificationDecision(user, "rejected", "Blurry scan");
    const [item] = await listNotifications(userId);
    expect(item).toMatchObject({
      kind: "verification",
      title: "We couldn't verify your documents",
      body: "Reason: Blurry scan",
      href: "/account",
    });
  });
});
