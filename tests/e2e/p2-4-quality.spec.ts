import { randomBytes } from "node:crypto";
import {
  test,
  expect,
  type Browser,
  type BrowserContextOptions,
  type TestInfo,
} from "@playwright/test";
import { e2eDb, signInAs } from "./auth-helpers";
import { makePaidBrandOrder, png, writeStorageFile } from "./brand-helpers";
import { axeViolations, horizontalOverflow } from "./helpers";
import { ORDER_PHONE } from "./order-helpers";

// P2.4: the Build Your Brand screens (all four /launch steps, My Brand, an
// order with a proof waiting for a decision) and their admin screens fit
// every width from 360 to 1280 px and have no axe issues at 360 and 1280 px.
// The quiz screens are checked the same way in quiz.last.spec.ts, which
// owns the one open quiz. Each test opens its own contexts, so only the
// desktop project runs it.

const widths = [360, 375, 414, 768, 1024, 1280];

type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

test.describe.configure({ timeout: 240_000 });

function runOnce(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== "desktop",
    "Sets its own viewports; the desktop project runs it.",
  );
}

async function open(browser: Browser, width: number, storageState?: StorageState) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 414 ? 800 : 768 },
    isMobile: width <= 414,
    hasTouch: width <= 414,
    storageState,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { context, page };
}

/** Signs in as `role` and returns the cookies, to reuse at every width. */
async function signedIn(browser: Browser, baseURL: string, role: "user" | "admin") {
  const { context, page } = await open(browser, 1280);
  const user = await signInAs(page, baseURL, { role, name: role === "user" ? "Asha Rao" : undefined });
  const state = await context.storageState();
  await context.close();
  return { user, state };
}

/**
 * A customer with a ready Launch cart (the product, at 8), a finished
 * packaging draft (with logo), a saved address, and a paid brand order
 * whose first proof is waiting for their decision.
 */
async function brandCustomer(userId: string) {
  const db = e2eDb();
  const order = await makePaidBrandOrder(userId);
  const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });

  const proofKey = `brand-proofs/${order.id.toLowerCase()}/${randomBytes(16).toString("hex")}.png`;
  await writeStorageFile(proofKey, png);
  await db.brandOrderDetails.update({
    where: { orderId: order.id },
    data: {
      stage: "proof_sent",
      proofs: {
        create: {
          version: 1,
          fileKey: proofKey,
          fileName: "proof-v1.png",
          contentType: "image/png",
          sizeBytes: png.byteLength,
          note: "First draft of your label",
        },
      },
      stageEvents: { create: { fromStage: "awaiting_proof", toStage: "proof_sent", actorKind: "admin" } },
    },
  });

  const logoKey = `brand-logos/draft-${randomBytes(16).toString("hex")}.png`;
  await writeStorageFile(logoKey, png);
  const profile = await db.brandProfile.create({
    data: {
      userId,
      profileName: "Asha Ayurveda",
      isDefault: true,
      brandName: "Asha Ayurveda",
      tagline: "Classical care, every day",
      marketedByName: "Asha Ayurveda LLP",
      marketedByAddress: "Flat 4, Shanti Apartments\nPune 411001",
      contactPhone: "+91 98765 43210",
      logoKey,
      logoName: "asha-logo.png",
      logoContentType: "image/png",
      logoSizeBytes: png.byteLength,
    },
  });
  await db.brandDraft.create({
    data: { userId, profileId: profile.id, notes: "Matte finish, please.", packagingDone: true },
  });
  if (item.productId) {
    await db.brandCartItem.create({ data: { userId, productId: item.productId, quantity: 8 } });
  }
  await db.address.create({
    data: {
      userId,
      name: "Asha Rao",
      phone: `+91${ORDER_PHONE}`,
      line1: "Flat 4, Shanti Apartments",
      line2: "FC Road",
      city: "Pune",
      state: "MH",
      pincode: "411001",
    },
  });
  return order;
}

/** Opens each path at each width and checks for sideways scroll (and axe at 360 and 1280). */
async function checkScreens(browser: Browser, paths: string[], state: StorageState) {
  for (const width of widths) {
    const { context, page } = await open(browser, width, state);
    for (const path of paths) {
      const response = await page.goto(path, { waitUntil: "load" });
      expect(response?.status(), `${path} at ${width}px`).toBe(200);
      expect(new URL(page.url()).pathname, `${path} at ${width}px`).toBe(path.split("?")[0]);
      expect(await horizontalOverflow(page), `${path} at ${width}px`).toBe(0);
      if (width === 360 || width === 1280) {
        expect(await axeViolations(page), `${path} at ${width}px`).toEqual([]);
      }
    }
    await context.close();
  }
}

test.describe("P2.4 quality pass", () => {
  test("Build Your Brand and My Brand fit every width", async ({ browser, baseURL }, testInfo) => {
    runOnce(testInfo);
    const { user, state } = await signedIn(browser, baseURL!, "user");
    const order = await brandCustomer(user.id);
    await checkScreens(
      browser,
      [
        "/launch?step=1",
        "/launch?step=2",
        "/launch?step=3",
        "/launch?step=4",
        "/my-brand",
        `/my-brand/${order.id}`,
      ],
      state,
    );
  });

  test("Phase 2 admin screens fit every width", async ({ browser, baseURL }, testInfo) => {
    runOnce(testInfo);
    const customer = await signedIn(browser, baseURL!, "user");
    const order = await brandCustomer(customer.user.id);
    const { state } = await signedIn(browser, baseURL!, "admin");
    await checkScreens(
      browser,
      [
        "/admin/brand-orders",
        `/admin/brand-orders/${order.id}`,
        "/admin/catalogue/brand-import",
        "/admin/content/quiz",
        "/admin/content/quiz/new",
      ],
      state,
    );
  });
});
