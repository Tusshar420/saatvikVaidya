# Test report: 25 October 2026

QA check of the site on `dev` against the project brief, before team testing
on the test address. The team's checklist is `docs/TEST_PLAN.md`.

## Result in short

- **The site works.** Every automatic test passes. Every main page opens on
  phone and computer with no errors and no sideways scrolling.
- **3 small bugs were found and fixed** (below).
- **2 gaps against the brief need an owner decision.** Courses can't be
  bought, and doctors have no area to create courses. Both are new features,
  and the brief rules out new features before launch.
- **3 set-up points must be handled before team testing** (staff admin
  accounts, payment details, sign-in by email only).

## What was checked

| Check | Result |
| --- | --- |
| Type check, lint | Pass |
| Unit tests (Vitest) | 919 of 919 pass |
| Browser tests (Playwright), phone 375 px and computer 1280 px | 311 pass, 9 skipped on purpose, 0 fail (after the fixes below: same) |
| QR / bank transfer order test (place order, pay screen, admin marks paid) | Pass on phone and computer |
| Production build | Pass |
| Hands-on: 46 pages at 375 and 1280 px, signed out and as customer, approved doctor, pharmacy (bulk) and admin | All load. No console errors, no sideways scroll |
| Hands-on: empty sign-in and sign-up forms, wrong password, forgot password | Clear messages under each field. Wrong password and unknown email give the same message (no account leak) |

The browser tests cover sign-up and sign-in (phone and email), sign-out,
forgot password, doctor verification and approval, Dr. Talk, the shop,
cart, checkout, orders, cancel and refund, invoices, Launch Your Brand
(cart, packaging, proofs, stages), the quiz (play, timer, coins,
leaderboard) and the admin panel.

**Not checked here:** real phones, Safari and Firefox (the automatic tests
use Chrome only), and the Hostinger server itself (MariaDB database, team
password, HTTPS). Those are in `docs/TEST_PLAN.md` sections 1 and 10 for the
team.

## Fixed

1. **"Page not found" was a dead end.** A wrong address or an old product
   link showed a bare "404" page: no logo, no links. It now shows "We
   couldn't find that page" with **Go to the homepage** and **Browse
   products**. Missing products and ebooks keep the site's header and
   footer. (`src/app/not-found.tsx`, `src/app/(site)/not-found.tsx`,
   `src/components/not-found-screen.tsx`)
2. **Bulk buyers couldn't find their branded orders again.** The My Brand
   page (branded orders and label proofs) had no link from any menu. "My
   orders" lists shop orders only. Added **My brand orders** to the account
   menu and **Branded orders** to the My account page.
3. **Quiz showed a "5:00" timer when no quiz was open.** The timer now only
   shows when there is a quiz to play.

Each fix has a browser test (`shell.spec.ts`, `account.spec.ts`,
`quiz.last.spec.ts`). `error-log.spec.ts` was updated for the new
not-found wording.

## Bigger issues (not fixed, need a decision)

| No. | Issue | Brief says | Effect | Suggestion |
| --- | --- | --- | --- | --- |
| B1 | **Courses can't be bought.** Course cards say "Enrolment opens soon" and offer a Call button. There is no price, cart or payment for courses. | "Courses: browse and buy." | Doctors' "sell courses" job can't be tested or done online. | Owner decides: launch with enrolment by phone (no delay), or build course sales after launch. Building it now is new work and puts 1 November at risk. |
| B2 | **No doctor area to create or manage courses.** Only staff add courses (Admin → Courses). Doctors can post in Dr. Talk. | "Doctor area: create and manage courses." | Same as B1. | Same as B1. For launch, staff can add doctors' courses for them. |
| B3 | **Staff can't be invited on the test address.** Admin invitations go by email, and emails aren't sent yet. | Firm staff run the site and test it. | Only the first admin can get in. Admin → Users → Add a user refuses the admin role ("Admins are invited from the Admins page"). | The developer runs `pnpm admin:create` once per staff member on the server (each one becomes a full "super" admin). Each needs an authenticator app. Or one shared admin for testing. |
| B4 | **No "bulk buyer" account type by that name.** Sign-up offers Customer, Ayurveda Doctor, Clinic / Hospital, Pharmacy / Store, Stockist / Distributor. Any signed-in account can place a Launch Your Brand order. | Three account types: doctor, regular buyer, bulk buyer. | Testers may be unsure what to pick. The test plan maps "bulk buyer" to Pharmacy / Store. | Owner decides whether the labels are fine. Renaming is a quick admin/data change. Adding a new type is small but is a change. |
| B5 | **Locked-out testers.** Forgot-password and sign-up emails aren't sent, phone codes (OTP) don't work, and there is no admin button to reset a user's password. | Everyone can sign in. | A tester who forgets a password needs a new account. | Fine for testing: testers write down passwords (the test plan says so), and staff can make a replacement account with a chosen password in Admin → Users → **Add a user** (not for admins). Real email sending is needed before many real customers sign up. |
| B6 | **Payment details are empty by default.** Until UPI ID and bank details are typed in Admin → Settings, the pay screen only says "please call us". | QR payment details show correctly. | The QR test fails if this is skipped. | Set-up step S2 in the test plan. Must also be done on the live site on 1 November. |

Smaller notes (no action needed for launch):

- The quiz page says "Built for professionals", but every signed-in account
  can play. That matches the brief ("quiz taking by users"). Change the
  wording only if the firm wants the quiz for professionals only.
- "Create shipment" is switched off on the server until the courier service
  is connected. Orders can still be marked paid or cancelled.
- A scheduled quiz must have exactly 10 questions. Staff should know this
  before writing quizzes.

## Effect on dates

- **1 November launch:** not at risk from bugs found today.
- **At risk only if** B1 and B2 must be built before launch. They are new
  features (course pricing, payment, access, a doctor course editor). They
  can't be built and tested properly by 31 October.
- **B3 blocks staff testing** until the developer creates the staff admin
  accounts. Do this first, on the day the test address goes up.

## Next steps

1. Owner: decide B1/B2 (launch with phone enrolment, or delay) and B4
   (labels).
2. Developer: create staff admin accounts on the test address (B3) and
   upload a new package with today's fixes.
3. Staff: set-up steps S1 to S5 in `docs/TEST_PLAN.md`, then the team runs
   the plan on at least one phone and one computer each.
4. Every Fail is fixed and re-tested before 31 October.
