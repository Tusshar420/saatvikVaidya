import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  policyPages,
  type PolicyPageCopy,
} from "../../src/content/pages";
import { brand } from "../../src/content/brand";
import { cart } from "../../src/content/cart";
import { catalogue } from "../../src/content/catalogue";
import { coins as coinsCopy } from "../../src/content/coins";
import { settingDefaults } from "../../src/content/settings";
import { orders } from "../../src/content/orders";
import { navItems, policyLinks, shell } from "../../src/content/shell";
import { signIn } from "../../src/content/sign-in";
import { ui } from "../../src/content/ui";
import { signInAs, useFreshIp } from "./auth-helpers";
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
  test("shows the logo, search, coins, bag and profile trigger", async ({
    page,
    isMobile,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    const bar = header(page);

    await expect(
      bar.getByRole("link", { name: shell.brand.homeLabel }),
    ).toBeVisible();
    // Signed out there's no coin balance to show, so no coin pill (A8).
    await expect(
      bar.getByRole("link", { name: /^[\d,]+ Saatvik Coins$/ }),
    ).toHaveCount(0);
    await expect(
      bar.getByRole("button", { name: shell.header.profileTitle }),
    ).toBeVisible();

    const searchbox = bar.getByRole("searchbox", { name: shell.search.label });
    const searchIcon = bar.getByRole("link", {
      name: shell.search.openSearch,
      exact: true,
    });
    const bag = bar.getByRole("link", { name: shell.header.bag(0) });
    const track = bar.getByRole("button", { name: shell.header.trackOrder });
    const phoneLink = bar.getByRole("link", { name: phone });

    if (isMobile) {
      // Phones: search is an icon; track order and phone step aside (the
      // dock has Orders). The bag stays, since the dock's second item is
      // My Brand (P2.1).
      await expect(searchIcon).toBeVisible();
      await expect(searchbox).toBeHidden();
      await expect(bag).toBeVisible();
      await expect(bag).toHaveAttribute("href", "/cart");
      await expect(track).toBeHidden();
      await expect(phoneLink).toBeHidden();
    } else {
      await expect(searchbox).toBeVisible();
      await expect(searchbox).toHaveAttribute(
        "placeholder",
        shell.search.placeholder,
      );
      await expect(searchIcon).toBeHidden();
      await expect(bag).toBeVisible();
      await expect(bag).toHaveAttribute("href", "/cart");
      await expect(bag).toContainText("0");
      await expect(track).toBeVisible();
      await expect(phoneLink).toBeVisible();
      await expect(phoneLink).toHaveAttribute("href", tel);
      // The phone number fits in the rail rather than being cut off.
      const railBox = await rail(page).boundingBox();
      const phoneBox = await phoneLink.boundingBox();
      expect(railBox && phoneBox).toBeTruthy();
      if (railBox && phoneBox)
        expect(phoneBox.x + phoneBox.width).toBeLessThanOrEqual(
          railBox.x + railBox.width,
        );
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
    const terms = settingDefaults["search.popular"];
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

  test("coins and bag lead to their ComingSoon pages", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    if (isMobile) {
      // Signed out, coins are reached from the dock (no header pill).
      await dock(page).getByRole("link", { name: shell.dock.coins }).click();
      await expect(page).toHaveURL("/coins");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        coinsCopy.title,
      );
    } else {
      await header(page)
        .getByRole("link", { name: shell.header.bag(0) })
        .click();
      // P1.4: the real cart, empty in a fresh browser.
      await expect(page).toHaveURL("/cart");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        cart.empty.title,
      );
    }
  });
});

test.describe("nav rail", () => {
  test("scrolls sideways and follows the section on screen", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const nav = rail(page);
    const scroller = nav.locator("> div");
    const home = nav.getByRole("link", { name: shell.nav.home, exact: true });
    const last = navItems[navItems.length - 1];
    const lastLink = nav.getByRole("link", { name: last.label });

    await expect(home).toHaveAttribute("aria-current", "location");

    if (isMobile) {
      // The links don't fit on a phone, so the rail scrolls sideways.
      const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(scrollWidth).toBeGreaterThan(clientWidth);
      await expect(lastLink).not.toBeInViewport();
    }

    // Scrolling to the last section highlights its link...
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(lastLink).toHaveAttribute("aria-current", "location");
    await expect(home).not.toHaveAttribute("aria-current");
    // ...and the rail scrolls to keep it in view.
    await expect(lastLink).toBeInViewport();
    if (isMobile)
      expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

    // A rail link jumps to its section and becomes the active one.
    const brands = nav.getByRole("link", { name: "Top Brands" });
    await brands.click();
    await expect(page).toHaveURL(/#brands$/);
    await expect(page.locator("#brands")).toBeInViewport();
    await expect(brands).toHaveAttribute("aria-current", "location");
  });

  test("links back to the homepage sections from other pages", async ({
    page,
  }) => {
    await page.goto("/coins");
    const nav = rail(page);
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    await nav.getByRole("link", { name: "Courses" }).click();
    await expect(page).toHaveURL(/\/#courses$/);
    await expect(page.locator("#courses")).toBeInViewport();
  });

  test("Launch Your Brand opens the Launch page, whatever the hash", async ({
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

    // After a section link has put a hash in the URL, the rail's Launch
    // link still opens the page instead of scrolling the homepage.
    await page.goto("/");
    const nav = rail(page);
    await nav.getByRole("link", { name: "Top Brands" }).click();
    await expect(page).toHaveURL(/#brands$/);
    const launch = nav.getByRole("link", { name: "Launch Your Brand" });
    await expect(launch).toHaveAttribute("href", "/launch");
    await launch.click();
    await onLaunchPage();
    await expect(launch).toHaveAttribute("aria-current", "page");

    // The homepage section's button.
    await page.goto("/#courses");
    await page
      .locator("#launch")
      .getByRole("link", { name: "Explore 150+ formulations" })
      .click();
    await onLaunchPage();

    // The footer link.
    await page.goto("/#coins");
    await footer(page).getByRole("link", { name: "Launch Your Brand" }).click();
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
      shell.dock.home,
      shell.dock.myBrand,
      shell.dock.orders,
      shell.dock.coins,
    ])
      await expect(bar.getByRole("link", { name: label })).toBeVisible();
    await expect(
      bar.getByRole("button", { name: shell.dock.profile }),
    ).toBeVisible();
    await expect(
      bar.getByRole("link", { name: shell.dock.home }),
    ).toHaveAttribute("aria-current", "page");

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

    // Dock links go to their pages and mark themselves current. Orders
    // needs sign-in (P1.5), so it's checked by its link only.
    await expect(
      bar.getByRole("link", { name: shell.dock.orders }),
    ).toHaveAttribute("href", "/orders");
    await bar.getByRole("link", { name: shell.dock.coins }).click();
    await expect(page).toHaveURL("/coins");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      coinsCopy.title,
    );
    await expect(
      bar.getByRole("link", { name: shell.dock.coins }),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("modals", () => {
  test("sign-in opens from the profile trigger and closes with Escape", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const dialog = await openAndEscape(
      page,
      header(page).getByRole("button", { name: shell.header.profileTitle }),
      signIn.title,
    );
    await expect(dialog).toHaveCount(0);

    if (isMobile) {
      await openAndEscape(
        page,
        dock(page).getByRole("button", { name: shell.dock.profile }),
        signIn.title,
      );
    }
  });

  test("sign-in starts in the phone field and closes from its close button", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = header(page).getByRole("button", {
      name: shell.header.profileTitle,
    });
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

  test("track order opens from the header and footer and closes with Escape", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");

    if (!isMobile) {
      await openAndEscape(
        page,
        header(page).getByRole("button", { name: shell.header.trackOrder }),
        shell.trackOrder.title,
      );
    }

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

  test("have no WCAG A/AA violations when open", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await header(page)
      .getByRole("button", { name: shell.header.profileTitle })
      .click();
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
      foot.getByText(settingDefaults["contact.supportNote"]),
    ).toBeVisible();
    await expect(
      foot.getByRole("link", { name: shell.footer.call(phone) }),
    ).toHaveAttribute("href", tel);
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
