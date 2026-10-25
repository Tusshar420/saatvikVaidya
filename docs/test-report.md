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
- **Update, later the same day:** the owner asked for the open points to be
  built. **B1, B2, B3, B7 and B8 are now done** (see "Built after the
  owner's go-ahead"). B4, B5 and B6 are set-up or wording points, not code.
- **Every automatic check passes** after these changes (one long brand-order
  test is slow and sometimes runs out of time in the full run; it passes on
  its own).

## Built after the owner's go-ahead (25 October)

| No. | What was built | How to test |
| --- | --- | --- |
| B1 | **Buying courses.** Staff (or a doctor) give a course a price. The card shows the price; the course page has **Enrol**, which puts it in the cart. Checkout and the QR / bank payment are the same as for medicines, with a GST invoice (SAC 999293, 18%) and no delivery charge. Once paid, the buyer sees "You're enrolled" and the joining details, the course appears under **My courses**, and the buyer and doctor get a notification. Courses without a price still offer a call. | `docs/TEST_PLAN.md` 5.1, 5.2, 5.8 to 5.11 |
| B2 | **Doctor's course area.** Approved doctors get **Teach a course** on My account: create and edit courses with price, format and joining details, see enrolments, and delete a course nobody has bought. Every new course or edit waits for staff: Admin → Courses shows "Waiting for review", and **Approve and list** or **Send back for changes** (with a note the doctor sees). Staff get a notification when a doctor sends one in. | 5.3 to 5.7 |
| B3 | **Staff invites without email.** Inviting an admin now shows the one-time link with **Copy link**, to send on WhatsApp. Only the first admin needs `pnpm admin:create`. | Set-up step S1 |
| B7 | **Side buttons on phones.** The round Feedback and WhatsApp buttons are left out on the cart, checkout and pay screens, so they never cover prices. | 6.4, 8.4 on a phone |
| B8 | **Staff menu.** Orders, Brand orders, Coins and Reports now sit near the top, above the home-page editing items. | Open the admin panel on a laptop |

Decisions made while building (easy to change later):

- A doctor's course is listed only after staff approve it, and **every edit
  goes back to review** (it is unlisted meanwhile; people who already paid
  keep their access).
- Paying doctors their share of sales happens outside the site (staff see
  enrolments per course). The doctor's form says so.
- Online courses are paid only. A free course can be listed without a price
  (people call to join).
- A course someone has paid for can't be deleted, only hidden.
- The introduction video is a link to YouTube, not a player on the page.
- Test courses made by test doctor accounts are removed by the "clear test
  data" step before launch, with those accounts.

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

## Bigger issues found (B1, B2, B3, B7, B8 are now built; see above)

B1 to B6 are unchanged from this morning's report.

| No. | Issue | Effect | Suggestion |
| --- | --- | --- | --- |
| B1 (built) | **Courses can't be bought.** Cards say "Enrolment opens soon" with a Call button. The brief says "Courses: browse and buy". | Doctors can't sell courses online. | Owner decides: launch with enrolment by phone, or build course sales after launch. Building it now puts 1 November at risk. |
| B2 (built) | **No doctor area to create or manage courses.** Only staff add courses. | Same as B1. | Same as B1. Staff can add doctors' courses for them at launch. |
| B3 (built) | **Staff can't be invited on the test address.** Invitations go by email, which isn't sent yet. | Only the first admin can get in. | Developer runs `pnpm admin:create` once per staff tester on the server. |
| B4 | **No sign-up option called "bulk buyer".** Testers pick Pharmacy / Store or Stockist / Distributor. | Testers may be unsure what to pick. The test plan explains it. | Owner decides whether the labels are fine. |
| B5 | **Locked-out testers.** No emails or phone codes, no admin password reset. | A tester who forgets a password needs a new account. | Fine for testing (the plan says to write passwords down). Real email is needed before many real customers sign up. |
| B6 | **Payment details are empty until staff fill them in** (Admin → Settings). Until then the pay screen only says "please call us". Seen again today. | The QR test fails if skipped. | Set-up step S2 in the test plan, and again on the live site on 1 November. |
| B7 (built) | **On phones, the Feedback and WhatsApp buttons on the right edge cover a little of the page.** For example, prices in the order summary pass under them while scrolling. They aren't in the client's phone design for My Profile. | Low. Nothing is blocked; scrolling shows the hidden part. | Owner or designer decides: keep, make them smaller, or hide them on cart, checkout and pay screens. |
| B8 (built) | **Staff menu order.** Orders, Brand orders, Quiz and Settings sit below ten home-page editing items, so on a laptop staff scroll the menu to reach them. | Low. Slower daily work. | Move the Orders group to the top of the menu. A small change; it waits for an owner yes. |

Smaller notes from this morning still apply: the quiz page says "Built for
professionals" though every account can play; "Create shipment" is off
until the courier is connected; a scheduled quiz needs exactly 10
questions.

## Checks after building B1 to B8

- Type check, lint, production build: pass.
- Unit tests: 928 of 928 pass (new tests for course sales, doctor courses,
  staff review, invite links and clearing test courses).
- Browser tests, phone and computer: all pass, including the new
  `courses.spec.ts` (a doctor creates a course, staff approve it, a buyer
  enrols, pays and opens it) and a test that the side buttons stay off the
  cart. The long brand-order test ran out of time once in the full run and
  passed when re-run on its own (it did the same earlier today, before any
  of this work).
- Settings and quiz tests: 27 pass (1 skipped on purpose). QR payment test:
  2 pass.
- New screens checked by eye at 375 and 1280 px: course page, cart with a
  course, doctor's course list and form, staff review, staff invite link.
  One thing fixed from this: the doctor's Delete link sat under the phone
  side buttons; it is now next to Edit.
- The database change only adds columns, so it is safe for existing data.
  The upload package must run the new migration (`pnpm db:deploy`, as in
  `docs/DEPLOY.md`).

## Still open

- **B4, B5, B6** above: labels, locked-out testers, and filling in payment
  details. These are set-up and wording points.
- **The Mac's disk is nearly full** (97%, about 6 GB free). The local
  database stopped once today, probably for this reason. Free some space
  before building the upload package.
- Real phones, Safari and Firefox, and the Hostinger server itself are for
  the team (`docs/TEST_PLAN.md` sections 1 and 10).

## Effect on dates

- **1 November launch:** not at risk from anything found or built today, as
  long as the new package goes up early enough for the team to test courses
  (TEST_PLAN section 5) before 31 October.

## Next steps

1. Developer: make and upload a new package with today's changes, and run
   the database migration on the test address.
2. Developer: create the first admin on the test address; that admin invites
   the other staff (S1).
3. Staff: set-up steps S1 to S5 in `docs/TEST_PLAN.md`. Then the team runs
   the plan and records every Fail in `docs/BUG_LOG.md`.
4. Owner: B4 (whether the sign-up labels are fine).
5. Every bug is fixed and re-checked before 31 October.
