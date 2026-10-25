# Test report: 25 October 2026 (second pass)

QA check of the site on `dev` against the project brief, before team testing
on the test address. This is the second pass today; the first one's fixes
(friendly "page not found" screen, "My brand orders" link, no quiz timer
without a quiz) are in commit `69ba8e3`.

For the team: the checklist is `docs/TEST_PLAN.md`, and problems go in the
new bug log, `docs/BUG_LOG.md`.

## Result in short

- **The site works.** Every page opens for every account type, on phone and
  computer, with no errors and no sideways scrolling.
- **4 small bugs found and fixed** (below).
- **The 6 open points from this morning still need the owner** (B1 to B6).
  Two new small suggestions added (B7, B8).
- **One check is unfinished:** the full browser test run after the fixes.
  Chrome stopped starting on this computer partway through (see "Not
  finished"). Run it once more before uploading the next package.

## What was checked

| Check | Result |
| --- | --- |
| Type check, lint, production build | Pass (after the fixes) |
| Unit tests (Vitest) | 919 of 919 pass (after the fixes) |
| Browser tests, full suite, phone 375 px and computer 1280 px | Before the fixes: 313 pass, 9 skipped on purpose, 0 fail |
| Browser tests for the screens the fixes touch (sign-in, account, Dr. Talk, coins, checkout, admin) | After the fixes: 66 of 66 pass |
| "Page not found" test, after its fix | 6 of 6 pass (3 times each on phone and computer) |
| QR / bank transfer order (place order, pay screen, staff mark paid) | Pass on phone and computer (before the fixes) |
| Hands-on: every main page as visitor, regular buyer, approved doctor, approved bulk buyer (pharmacy) and staff, at 375 and 1280 px (about 120 page views) | All open. No browser errors. No sideways scroll |
| Hands-on: sign up by email as Ayurveda Doctor, Pharmacy / Store and Customer, on phone and computer | Works. Welcome message, name in the header, right account type on My account |
| Hands-on: add to cart, add an address, place order, pay screen, My orders (phone and computer) | Works |

## Fixed

1. **Email accounts said "Mobile verification pending".** Every tester signs
   up by email (phone codes don't work on the test address), and their
   account page said the mobile number still needed checking, though they
   never gave one. The line now only shows for accounts with a mobile
   number. (`src/app/(site)/account/page.tsx`; check added to
   `sign-in.spec.ts`)
2. **Two names for the same coins.** The site says "Saatvik Coins"
   everywhere, but checkout, order details and the staff pages said "Super
   Coins". Now it is "Saatvik Coins" everywhere. (`src/content/coins.ts`,
   `admin.ts`, `admin-site.ts`, `admin-security.ts`)
3. **Old wording on Dr. Talk.** The "Verified Doctors" box said "Doctor
   verification opens with Dr. Talk", as if verification weren't open yet.
   It now says a list of verified doctors who post is coming soon.
   (`src/content/portal-pages.ts`)
4. **Missing product: the browser tab title changed at random** between
   "Product not found" and "Page not found". It is now always "Page not
   found", matching the screen. (`src/app/(site)/products/[slug]/page.tsx`)

## Bigger issues (not fixed, need a decision)

B1 to B6 are unchanged from this morning's report.

| No. | Issue | Effect | Suggestion |
| --- | --- | --- | --- |
| B1 | **Courses can't be bought.** Cards say "Enrolment opens soon" with a Call button. The brief says "Courses: browse and buy". | Doctors can't sell courses online. | Owner decides: launch with enrolment by phone, or build course sales after launch. Building it now puts 1 November at risk. |
| B2 | **No doctor area to create or manage courses.** Only staff add courses. | Same as B1. | Same as B1. Staff can add doctors' courses for them at launch. |
| B3 | **Staff can't be invited on the test address.** Invitations go by email, which isn't sent yet. | Only the first admin can get in. | Developer runs `pnpm admin:create` once per staff tester on the server. |
| B4 | **No sign-up option called "bulk buyer".** Testers pick Pharmacy / Store or Stockist / Distributor. | Testers may be unsure what to pick. The test plan explains it. | Owner decides whether the labels are fine. |
| B5 | **Locked-out testers.** No emails or phone codes, no admin password reset. | A tester who forgets a password needs a new account. | Fine for testing (the plan says to write passwords down). Real email is needed before many real customers sign up. |
| B6 | **Payment details are empty until staff fill them in** (Admin → Settings). Until then the pay screen only says "please call us". Seen again today. | The QR test fails if skipped. | Set-up step S2 in the test plan, and again on the live site on 1 November. |
| B7 (new) | **On phones, the Feedback and WhatsApp buttons on the right edge cover a little of the page.** For example, prices in the order summary pass under them while scrolling. They aren't in the client's phone design for My Profile. | Low. Nothing is blocked; scrolling shows the hidden part. | Owner or designer decides: keep, make them smaller, or hide them on cart, checkout and pay screens. |
| B8 (new) | **Staff menu order.** Orders, Brand orders, Quiz and Settings sit below ten home-page editing items, so on a laptop staff scroll the menu to reach them. | Low. Slower daily work. | Move the Orders group to the top of the menu. A small change; it waits for an owner yes. |

Smaller notes from this morning still apply: the quiz page says "Built for
professionals" though every account can play; "Create shipment" is off
until the courier is connected; a scheduled quiz needs exactly 10
questions.

## Not finished

- **Full browser test run after the fixes.** Partway through, Chrome stopped
  starting from this session on the Mac (a macOS session problem, not the
  site). The tests for every changed screen did pass first (table above),
  and the fixes only change wording, one title and one line on the account
  page. Next step: run `pnpm test:e2e` in a fresh terminal before making
  the next upload package.
- **The local database (MySQL) stopped on its own** during testing and was
  started again. Nothing was lost. The Mac's disk is **98% full (about 5 GB
  free)**, which can cause this. Free some space before building the
  upload package.
- Real phones, Safari and Firefox, and the Hostinger server itself are for
  the team (`docs/TEST_PLAN.md` sections 1 and 10).

## Effect on dates

- **1 November launch:** not at risk from anything found today.
- **At risk only if** B1 and B2 must be built before launch.
- **B3 blocks staff testing** until the developer creates the staff admin
  accounts. Do it first on the day the test address goes up.

## Next steps

1. Developer: run the full browser tests in a fresh terminal, then make and
   upload a new package with today's fixes.
2. Developer: create staff admin accounts on the test address (B3).
3. Owner: decide B1/B2, B4, and the two small ones, B7 and B8.
4. Staff: set-up steps S1 to S5 in `docs/TEST_PLAN.md`. Then the team runs
   the plan and records every Fail in `docs/BUG_LOG.md`.
5. Every bug is fixed and re-checked before 31 October.
