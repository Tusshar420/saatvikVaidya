import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { clearContentTables } from "../../../tests/setup/content-db";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";

// Every admin server action is a public endpoint, so each must check the
// admin session itself before touching anything. requireAdmin() is mocked:
// first to refuse (as it does for visitors and non-admins), then to allow.

const session = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({
  requireAdmin: session.requireAdmin,
}));

// Outside a Next request these would throw for other reasons; they're
// checked separately where it matters.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (read: () => Promise<unknown>) => read,
}));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => navigation);

const users = await import("./users/actions");
const content = await import("./content/actions");
const cache = await import("next/cache");

const idle = { status: "idle" } as const;
let types: Record<string, number>;

function formData(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of [value].flat()) data.append(name, item);
  }
  return data;
}

async function tableCounts() {
  const [users, logs, reels, brands, courses, quizzes] = await Promise.all([
    db.user.count(),
    db.adminLog.count(),
    db.reel.count(),
    db.brand.count(),
    db.courseTeaser.count(),
    db.quiz.count(),
  ]);
  return { users, logs, reels, brands, courses, quizzes };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await clearContentTables(db);
  await resetAuthData(db);
  types = await userTypeIds(db);
  await db.user.create({
    data: {
      id: "victim",
      name: "Dr Victim",
      email: "victim@example.test",
      userTypeId: types.doctor,
      verificationStatus: "pending",
      termsAcceptedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("without an admin session", () => {
  beforeEach(() => {
    session.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
  });

  const userForm = formData({
    name: "Mallory",
    email: "mallory@example.test",
    userTypeId: "1",
    role: "admin",
    verificationStatus: "none",
    password: "a-long-unusual-password",
  });
  const reel = formData({
    key: "evil",
    title: "Evil",
    mediaKind: "IMAGE",
    type: "OFFER",
    mediaSrc: "/media/x.jpg",
    linkLabel: "x",
    sortOrder: "1",
  });

  const calls: [string, () => Promise<unknown>][] = [
    ["createUserAction", () => users.createUserAction(idle, userForm)],
    ["updateUserAction", () => users.updateUserAction("victim", idle, userForm)],
    [
      "bulkUsersAction",
      () =>
        users.bulkUsersAction(
          idle,
          formData({ operation: "delete", ids: ["victim"] }),
        ),
    ],
    [
      "decideUserAction",
      () =>
        users.decideUserAction(
          idle,
          formData({ id: "victim", decision: "approved" }),
        ),
    ],
    ["deleteUserAction", () => users.deleteUserAction(formData({ id: "victim" }))],
    ["createReelAction", () => content.createReelAction(idle, reel)],
    ["updateReelAction", () => content.updateReelAction(1, idle, reel)],
    ["deleteReelAction", () => content.deleteReelAction(formData({ id: "1" }))],
    ["createBrandAction", () => content.createBrandAction(idle, reel)],
    ["updateBrandAction", () => content.updateBrandAction(1, idle, reel)],
    ["deleteBrandAction", () => content.deleteBrandAction(formData({ id: "1" }))],
    ["createCourseAction", () => content.createCourseAction(idle, reel)],
    ["updateCourseAction", () => content.updateCourseAction(1, idle, reel)],
    ["deleteCourseAction", () => content.deleteCourseAction(formData({ id: "1" }))],
    ["createQuizAction", () => content.createQuizAction(idle, reel)],
    ["updateQuizAction", () => content.updateQuizAction(1, idle, reel)],
    ["deleteQuizAction", () => content.deleteQuizAction(formData({ id: "1" }))],
  ];

  it("covers every exported action", () => {
    const exported = [
      ...Object.keys(users),
      ...Object.keys(content),
    ].filter((name) => name.endsWith("Action"));
    expect(calls.map(([name]) => name).sort()).toEqual(exported.sort());
  });

  it.each(calls)("%s refuses and changes nothing", async (_name, call) => {
    const before = await tableCounts();
    await expect(call()).rejects.toThrow("NOT_FOUND");
    expect(await tableCounts()).toEqual(before);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: "victim" } }))
        .verificationStatus,
    ).toBe("pending");
  });
});

describe("with an admin session", () => {
  beforeEach(async () => {
    await db.user.create({
      data: {
        id: "the-admin",
        name: "The Admin",
        email: "the-admin@example.test",
        role: "admin",
        userTypeId: types.customer,
        termsAcceptedAt: new Date(),
      },
    });
    session.requireAdmin.mockResolvedValue({ user: { id: "the-admin" } });
  });

  it("returns field errors and the submitted values (without the password)", async () => {
    const state = await users.createUserAction(
      idle,
      formData({
        name: "X",
        email: "bad",
        userTypeId: String(types.customer),
        role: "user",
        verificationStatus: "none",
        password: "secret-typed-value",
      }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("name");
    expect(state.fieldErrors).toHaveProperty("email");
    expect(state.values).toMatchObject({ name: "X", password: "" });
  });

  it("bulk approves and reports what happened", async () => {
    const state = await users.bulkUsersAction(
      idle,
      formData({ operation: "approve", ids: ["victim", "the-admin"], note: "OK" }),
    );
    expect(state).toMatchObject({ status: "success" });
    expect(state.message).toMatch(/Approved 1\. Skipped 1/);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: "victim" } }))
        .verificationStatus,
    ).toBe("approved");
  });

  it("refuses a bulk action with nothing selected", async () => {
    const state = await users.bulkUsersAction(
      idle,
      formData({ operation: "approve" }),
    );
    expect(state.status).toBe("error");
  });

  it("creating a reel refreshes the homepage cache and redirects to the list", async () => {
    await expect(
      content.createReelAction(
        idle,
        formData({
          key: "fresh-reel",
          title: "Fresh",
          mediaKind: "IMAGE",
          type: "OFFER",
          mediaSrc: "/media/saatvik-rewards.jpg",
          linkLabel: "Look",
          sortOrder: "1",
        }),
      ),
    ).rejects.toThrow("REDIRECT /admin/content/reels?notice=created");
    expect(cache.updateTag).toHaveBeenCalledWith("content:home");
    expect(await db.reel.findUnique({ where: { key: "fresh-reel" } })).not.toBeNull();
  });

  it("a bad key comes back as a field error", async () => {
    const state = await content.createBrandAction(
      idle,
      formData({ key: "Not A Slug!", name: "B" }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("key");
  });

  it("rejects a non-numeric id with a 404", async () => {
    await expect(
      content.deleteReelAction(formData({ id: "1 OR 1=1" })),
    ).rejects.toThrow("NOT_FOUND");
  });
});
