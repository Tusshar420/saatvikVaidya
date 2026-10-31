import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  policyPages,
  type PolicyPageCopy,
} from "../../src/content/pages";
import { account } from "../../src/content/account";
import { brand } from "../../src/content/brand";
import { cart } from "../../src/content/cart";
import { catalogue } from "../../src/content/catalogue";
import { coins as coinsCopy } from "../../src/content/coins";
import { notFoundScreen } from "../../src/content/errors";
import { settingDefaults } from "../../src/content/settings";
import { orders } from "../../src/content/orders";
import { policyLinks, shell, siteNav } from "../../src/content/shell";
import { signIn } from "../../src/content/sign-in";
import { ui } from "../../src/content/ui";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

const phone = settingDefaults["contact.phone"];
const tel = "tel:+919220358400";

const policyCopy: Record<string, PolicyPageCopy> = {
  "/privacy": policyPages.privacy,
  "/terms": policyPages.terms,
  "/shipping": policyPages.shipping,
  "/rewards-policy": policyPages.rewards,
};

const header = (page: Page) => page.getByRole("banner");
const rail = (page: Page) =>
  page.getByRole("navigation", { name: shell.nav.label });
const dock = (page: Page) =>
  page.getByRole("navigation", { name: shell.dock.label });
const footer = (page: Page) => page.getByRole("contentinfo");

/** Opens a modal from `trigger`, checks focus moves in, then closes it with Escape. */
async function openAndEscape(page: Page, trigger: Locator, title: string) {
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  return dialog;
}

test.describe("header", () => {
  test("shows the logo, search, bag and profile trigger", async ({
    page,
    isMobile,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    const bar = header(page);

    await expect(
      bar.getByRole("link", { name: shell.brand.homeLabel }),
    ).toBeVisible();
    // Coins live in the orange bar above the header, so the only Coins link
    // in the header is the nav rail's; the bar has no coin pill.
    await expect(bar.getByRole("link", { name: /Coins/ })).toHaveCount(
      await rail(page).getByRole("link", { name: /Coins/ }).count(),
    );
    // Phones have no profile trigger in the bar: the dock's "You" tab
    // (/account) signs in instead.
    if (isMobile) {
      await expect(
        bar.getByRole("button", { name: shell.header.profileTitle }),
      ).toBeHidden();
      await expect(
        dock(page).getByRole("link", { name: shell.dock.you }),
      ).toHaveAttribute("href", "/account");
    } else {
      await expect(
        bar.getByRole("button", { name: shell.header.profileTitle }),
      ).toBeVisible();
    }

    const searchbox = bar.getByRole("searchbox", { name: shell.search.label });
    const searchIcon = bar.getByRole("link", {
      name: shell.search.openSearch,
      exact: true,
    });
    const bag = bar.getByRole("link", { name: shell.header.bag(0) });

    // v2 (U.4): Track Order lives in the nav rail and the phone number in
    // the footer, so the bar has neither.
    await expect(
      bar.getByRole("button", { name: shell.header.trackOrder }),
    ).toHaveCount(0);

    if (isMobile) {
      // Phones: search is an icon.
      await expect(searchIcon).toBeVisible();
      await expect(searchbox).toBeHidden();
      await expect(bag).toBeVisible();
      await expect(bag).toHaveAttribute("href", "/cart");
    } else {
      await expect(searchbox).toBeVisible();
      await expect(searchbox).toHaveAttribute(
        "placeholder",
        shell.search.placeholder,
      );
      await expect(searchIcon).toBeHidden();
      await expect(bag).toBeVisible();
      await expect(bag).toHaveAttribute("href", "/cart");
    }

    // The header stays stuck to the top while the page scrolls.
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(async () => (await bar.boundingBox())?.y).toBe(0);

    expect(errors).toEqual([]);
  });

  test("search offers popular searches and goes to /search", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const bar = header(page);

    if (isMobile) {
      await bar
        .getByRole("link", { name: shell.search.openSearch, exact: true })
        .click();
      await expect(page).toHaveURL("/search");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        catalogue.search.title,
      );
      // Phones have no header field, so the page has its own.
      await expect(
        page.getByRole("main").getByRole("searchbox", { name: catalogue.search.label }),
      ).toBeVisible();
      return;
    }

    const searchbox = bar.getByRole("searchbox", { name: shell.search.label });
    const popular = bar.getByRole("list", { name: shell.search.popularTitle });

    // ⌘K / Ctrl+K focuses the field, which opens the popover.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(searchbox).toBeFocused();
    await expect(popular).toBeVisible();
    // The saved setting, which an admin may have changed from the default.
    const db = e2eDb();
    const stored = await db.setting.findUnique({ where: { key: "search.popular" } });
    await db.$disconnect();
    const terms = (stored?.value as string[] | undefined) ?? settingDefaults["search.popular"];
    await expect(popular.getByRole("link")).toHaveText([...terms]);

    // Escape closes it and keeps focus in the field.
    await page.keyboard.press("Escape");
    await expect(popular).toBeHidden();
    await expect(searchbox).toBeFocused();

    // Typing hides it; Enter submits to /search with the query.
    await searchbox.fill("Ashwagandha");
    await expect(popular).toBeHidden();
    await searchbox.press("Enter");
    await expect(page).toHaveURL("/search?q=Ashwagandha");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      catalogue.search.title,
    );
    // Real results (P1.3): the sample products with Ashwagandha in them.
    await expect(
      page.getByRole("heading", { name: /products? for “Ashwagandha”/ }),
    ).toBeVisible();

    // A popular search is a link to its results.
    await page.goto("/");
    await searchbox.focus();
    await popular.getByRole("link", { name: terms[0] }).click();
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(
      page.getByRole("heading", { name: new RegExp(`for “${terms[0]}”`) }),
    ).toBeVisible();
  });

  test("the bag leads to the cart", async ({ page }) => {
    await page.goto("/");
    await header(page)
      .getByRole("link", { name: shell.header.bag(0) })
      .click();
    // P1.4: the real cart, empty in a fresh browser.
    await expect(page).toHaveURL("/cart");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      cart.empty.title,
    );
  });
});

test.describe("nav rail", () => {
  test("links to every main page and marks the current one", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const nav = rail(page);
    const scroller = nav.locator("> div");
    const last = siteNav[siteNav.length - 1];
    const lastLink = nav.getByRole("link", { name: last.label });

    // No Home link: the logo is the way home (client, 31 Oct 2026).
    await expect(nav.getByRole("link", { name: /^home$/i })).toHaveCount(0);
    for (const link of siteNav) {
      const navLink = nav.getByRole("link", { name: link.label, exact: true });
      // Courses, Saatvik Coins and Track Order are left off on phones,
      // where the bottom dock has them.
      if (isMobile && link.wideOnly) await expect(navLink).toBeHidden();
      else {
        await expect(navLink).toBeVisible();
        await expect(navLink).toHaveAttribute("href", link.href);
      }
    }

    // The client's order (30 Oct 2026), phone and desktop.
    const shown = await nav
      .getByRole("link")
      .evaluateAll((links) =>
        links
          .filter((a) => (a as HTMLElement).offsetParent !== null)
          .map((a) => a.textContent?.trim()),
      );
    expect(shown).toEqual(
      isMobile
        ? [
            "Dr. Talk",
            "Quiz & Win",
            "Build Your Brand",
            "Top Brands",
            "Real Feedback",
            "Partner & Grow",
            "Why Saatvik",
          ]
        : [
            "Dr. Talk",
            "Courses",
            "Quiz & Win",
            "Build Your Brand",
            "Top Brands",
            "Saatvik Coins",
            "Track Order",
            "Real Feedback",
            "Partner & Grow",
            "Why Saatvik",
          ],
    );

    if (isMobile) {
      // The links don't fit on a phone, so the rail scrolls sideways.
      const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(scrollWidth).toBeGreaterThan(clientWidth);
      await expect(lastLink).not.toBeInViewport();
    }

    // A rail link opens its page and becomes the current one.
    const brands = nav.getByRole("link", { name: "Top Brands" });
    await brands.click();
    await expect(page).toHaveURL("/products");
    await expect(brands).toHaveAttribute("aria-current", "page");

    // The logo takes you back home.
    await header(page)
      .getByRole("link", { name: shell.brand.homeLabel })
      .click();
    await expect(page).toHaveURL("/");
    await expect(brands).not.toHaveAttribute("aria-current");
  });

  test("Build Your Brand opens the Launch page", async ({
    page,
    baseURL,
  }) => {
    await useFreshIp(page);
    await signInAs(page, baseURL!, { role: "user" });
    const onLaunchPage = async () => {
      await expect(page).toHaveURL(/\/launch(\?|$)/);
      await expect(
        page.getByRole("list", { name: brand.launch.stepsLabel }),
      ).toBeVisible();
    };

    await page.goto("/");
    const nav = rail(page);
    const launch = nav.getByRole("link", { name: "Build Your Brand" });
    await expect(launch).toHaveAttribute("href", "/launch");
    await launch.click();
    await onLaunchPage();
    await expect(launch).toHaveAttribute("aria-current", "page");

    // The footer link.
    await page.goto("/");
    await footer(page).getByRole("link", { name: "Build Your Brand" }).click();
    await onLaunchPage();
  });
});

test.describe("mobile dock", () => {
  test("shows only on phones", async ({ page, isMobile }) => {
    await page.goto("/");
    const bar = dock(page);

    if (!isMobile) {
      await expect(bar).toBeHidden();
      return;
    }

    await expect(bar).toBeVisible();
    for (const label of [
      shell.dock.coins,
      shell.dock.updates,
      shell.dock.courses,
      shell.dock.orders,
      shell.dock.you,
    ])
      await expect(bar.getByRole("link", { name: label })).toBeVisible();
    await expect(bar.getByRole("button")).toHaveCount(0);
    await expect(bar.getByRole("link")).toHaveCount(5);

    // Fixed to the bottom edge.
    const viewport = page.viewportSize();
    const dockBox = await bar.boundingBox();
    expect(dockBox && viewport).toBeTruthy();
    if (!dockBox || !viewport) return;
    expect(Math.round(dockBox.y + dockBox.height)).toBe(viewport.height);

    // At the end of the page the footer's last line sits above the dock.
    // The page scrolls smoothly, so jump instantly and wait for it to settle.
    const lastPolicy = footer(page)
      .getByRole("link", { name: policyLinks[policyLinks.length - 1].label })
      .last();
    await expect
      .poll(async () => {
        await page.evaluate(() =>
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "instant",
          }),
        );
        const box = await lastPolicy.boundingBox();
        return box ? box.y + box.height : Infinity;
      })
      .toBeLessThanOrEqual(dockBox.y);

    // Dock links go to their pages and mark themselves current. Orders,
    // Updates and You need sign-in, so they are checked by link only.
    const hrefs = {
      [shell.dock.updates]: "/notifications",
      [shell.dock.orders]: "/orders",
      [shell.dock.you]: "/account",
    };
    for (const [label, href] of Object.entries(hrefs))
      await expect(bar.getByRole("link", { name: label })).toHaveAttribute("href", href);
    await bar.getByRole("link", { name: shell.dock.courses }).click();
    await expect(page).toHaveURL("/courses");
    await expect(
      bar.getByRole("link", { name: shell.dock.courses }),
    ).toHaveAttribute("aria-current", "page");
  });
});

/**
 * The sign-in trigger for this width: the header's profile button, or on
 * phones the "Sign in / Register" button on the dock's "You" page.
 */
async function signInTrigger(page: Page, isMobile: boolean) {
  if (!isMobile) {
    await page.goto("/");
    return header(page).getByRole("button", { name: shell.header.profileTitle });
  }
  await page.goto("/");
  await dock(page).getByRole("link", { name: shell.dock.you }).click();
  await expect(page).toHaveURL(/\/account$/);
  return page.getByRole("main").getByRole("button", { name: account.guest.signIn });
}

test.describe("modals", () => {
  test("sign-in opens from the profile trigger and closes with Escape", async ({
    page,
    isMobile,
  }) => {
    const dialog = await openAndEscape(
      page,
      await signInTrigger(page, isMobile),
      signIn.title,
    );
    await expect(dialog).toHaveCount(0);
  });

  test("sign-in starts in the phone field and closes from its close button", async ({
    page,
    isMobile,
  }) => {
    const trigger = await signInTrigger(page, isMobile);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: signIn.title });
    await expect(dialog).toHaveAccessibleDescription(signIn.description);
    await expect(
      dialog.getByRole("tab", { name: signIn.tabs.mobile }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      dialog.getByRole("tab", { name: signIn.tabs.email }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: signIn.phone.label }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: ui.close }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("track order opens from the footer and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/");

    const footerTrigger = footer(page).getByRole("button", {
      name: shell.footer.trackOrder,
    });
    await footerTrigger.click();
    const dialog = page.getByRole("dialog", { name: shell.trackOrder.title });
    await expect(dialog).toBeVisible();
    // The real lookup form (P1.5); tests/e2e/orders.spec.ts tracks an order.
    await expect(
      dialog.getByRole("textbox", { name: orders.track.number }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: orders.track.contact }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: orders.track.submit }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: shell.trackOrder.call(phone) }),
    ).toHaveAttribute("href", tel);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(footerTrigger).toBeFocused();
  });

  test("have no WCAG A/AA violations when open", async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await (await signInTrigger(page, isMobile)).click();
    await expect(
      page.getByRole("dialog", { name: signIn.title }),
    ).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await footer(page)
      .getByRole("button", { name: shell.footer.trackOrder })
      .click();
    await expect(
      page.getByRole("dialog", { name: shell.trackOrder.title }),
    ).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe("pages", () => {
  test("skip link jumps to the main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: shell.skipLink });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("the side Feedback and WhatsApp buttons stay off the cart and checkout", async ({ page }) => {
    const quickContact = page.getByRole("complementary", { name: shell.sticky.label });
    await page.goto("/");
    await expect(quickContact.getByRole("link", { name: shell.sticky.feedback })).toBeVisible();
    // Prices sit at the right edge there, where the buttons would cover them.
    await page.goto("/cart");
    await expect(quickContact).toHaveCount(0);
    await page.goto("/products");
    await expect(quickContact).toBeVisible();
  });

  test("/coins explains the rules to a signed-out visitor", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/coins");
    await expect(page).toHaveTitle(new RegExp(`^${coinsCopy.metaTitle} · `));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(coinsCopy.title);
    await expect(page.getByText(coinsCopy.signedOutLine)).toBeVisible();
    await expect(page.getByRole("heading", { name: coinsCopy.earn.title })).toBeVisible();
    await expect(page.getByRole("heading", { name: coinsCopy.use.title })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("footer policy links open their placeholder pages", async ({ page }) => {
    for (const link of policyLinks) {
      await page.goto("/");
      await footer(page)
        .getByRole("navigation", { name: shell.footer.policiesLabel })
        .getByRole("link", { name: link.label })
        .click();
      await expect(page).toHaveURL(link.href);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        policyCopy[link.href].title,
      );
      await expect(page.getByText(policyPages.body)).toBeVisible();
    }
  });

  test("the footer shows the settings text and phone link", async ({
    page,
  }) => {
    await page.goto("/");
    const foot = footer(page);
    await expect(
      foot.getByText(settingDefaults["footer.tagline"]),
    ).toBeVisible();
    await expect(
      foot.getByRole("link", { name: shell.footer.call(phone) }),
    ).toHaveAttribute("href", tel);
  });

  test("a wrong address or missing product shows a way back, not a dead end", async ({
    page,
  }) => {
    for (const route of ["/no-such-page", "/products/no-such-product"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(new RegExp(`^${notFoundScreen.metaTitle}`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        notFoundScreen.title,
      );
      await expect(
        page.getByRole("main").getByRole("link", { name: notFoundScreen.products }),
      ).toHaveAttribute("href", "/products");
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(await axeViolations(page)).toEqual([]);
    }
    // A missing product keeps the site's header; the home link goes home.
    await expect(header(page)).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("link", { name: notFoundScreen.home })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("shell pages load cleanly with no sideways scroll or WCAG violations", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of ["/", "/cart", "/privacy"]) {
      const errors = collectErrors(page);
      await page.goto(route);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(await axeViolations(page)).toEqual([]);
      expect(errors).toEqual([]);
    }
  });
});
