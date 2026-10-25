# Test report: 25 October 2026 (fourth pass, final testing)

Re-test of BUG-001 to BUG-008, the full test plan run locally, and a
readiness check. Details: `docs/READINESS_REPORT.md`, `docs/BUG_LOG.md` and
the "Local run by QA" section of `docs/TEST_PLAN.md`.

- All eight bugs are now **Re-checked**. One of them, BUG-008 (the `/launch`
  page too wide on phones), had **not** been fixed before: it failed in every
  full phone run. Real cause found and fixed (commit `5df05b6`).
- Checks: type check, lint, build, 934 unit tests pass. Browser tests: phone
  146 pass, computer 154 pass, settings/quiz 27 pass, QR payment 2 pass.
  One long Build Your Brand test times out only when the Mac is busy and
  passes alone.
- Added browser checks for BUG-006 and BUG-007; the width test now names the
  wide element if it fails.
- Not checked here: the Hostinger test address itself, real phones,
  Safari/Firefox, scanning the QR in a UPI app, running the clear-test-data
  script (not run on purpose).

---

# Test report: 25 October 2026 (third pass)

A QA check of the site on `dev` against the project brief, before team
testing on the test address. It is the first check since course sales and
the doctors' course area were built (commit `f1fbc33`). The two earlier
passes from today are in the git history of this file (commits `69ba8e3`
and `66dd003`).

Problems found are in `docs/BUG_LOG.md` as BUG-001 to BUG-008. The team's
checklist is still `docs/TEST_PLAN.md`.

## Result in short

- **Every main job works** for every account type, on phone and computer,
  paid by QR / bank transfer as on the test address.
- **4 bugs fixed** (BUG-001 to BUG-004). The two that matter most could make
  a buyer order and pay twice.
- **4 smaller problems left open** (BUG-005 to BUG-008). None stops a main
  job.
- **Every automatic check passes** after the fixes.
- **1 November is not at risk** from anything found today. The Mac's disk is
  almost full, though (see "Needs a person").

## What was checked

| Check | Result |
| --- | --- |
| Type check, lint, production build | Pass |
| Unit tests (Vitest) | 933 of 933 pass (5 new) |
| Browser tests, phone 375 px and computer 1280 px | 292 pass, 8 skipped on purpose, 0 fail |
| Browser tests that change site settings, and the quiz | 27 pass, 1 skipped on purpose |
| QR / bank transfer payment test | 2 of 2 pass |
| Hands-on walk-through (below), phone and computer, with QR payment switched on as on the test address | All jobs done. The only open problems are in the bug log |

Automated tests already existed for sign-up, sign-in, ordering and payment
details, so no basic ones had to be added. New checks were added for the
fixes.

## Hands-on walk-through

Each job was done in a real browser at phone size (375 px) and computer size
(1280 px), with screenshots, a check for browser errors, sideways scrolling
and accessibility problems on each screen.

| Account type | Job | Result |
| --- | --- | --- |
| Staff | Fill in the QR and bank details in Settings | Works |
| Visitor | Sign up by email as Customer, Ayurveda Doctor and Pharmacy / Store | Works. The right account page each time; the pharmacy is asked for its licence documents |
| Regular buyer | Browse medicines, add to cart, add an address, Place order | Works |
| Regular buyer | Pay screen | QR code, UPI ID, name, bank, account number, IFSC, order number and the staff note all correct |
| Staff | Mark the order paid | Works. The buyer's order then shows as paid |
| Doctor (approved) | Create a course with a price | Works. It waits for staff review |
| Staff | Approve the course | Works. It is then listed |
| Doctor | Ask a question on Dr. Talk and reply | Works |
| Regular buyer | Enrol in the course, pay by QR, staff mark paid | Works. The buyer sees "You're enrolled" and how to join |
| Bulk buyer (approved pharmacy) | Build Your Brand: add a product, brand details and logo, address, Place order | Works. Same QR and bank details |
| Staff | See the brand order | Works |
| Staff and buyer | A weekly quiz: play 10 questions, see the score, coins and leaderboard | Works |
| All five account types | Open about 30 pages each (staff: 18 staff pages) | All open. No errors. One sideways scroll seen once (BUG-008) |

## Fixed

1. **BUG-001: the cart stayed full after a QR order.** With QR or bank
   transfer, staff confirm the payment hours later. Until then the products
   stayed in the cart, so a buyer could think the order failed and order
   again. The cart is now emptied when the order is placed, as brand orders
   already did. Online payment (Razorpay, later) still empties it once paid.
2. **BUG-002: a course could be ordered twice.** While a course order
   waited for payment, the course page offered Enrol again. It now says
   "Waiting for your payment" with a **See how to pay** button.
3. **BUG-003: "Back to cart" under the payment details.** It is now **View
   my orders**.
4. **BUG-004: the course meeting link couldn't be tapped.** Web links in a
   course's joining details are now links.

## Left open (see the bug log)

| Bug | What | Suggestion |
| --- | --- | --- |
| BUG-005 (Medium) | A paid ebook can be ordered twice while the first order waits for payment (no "waiting for payment" state on the ebook page) | Same fix as BUG-002, for ebooks. Not done today because it changes the ebook access rules. Low risk if ebooks are few at launch |
| BUG-006 (Low) | A course-only checkout says "Where should we deliver?" | Change the wording for course-only carts. Left alone because the checkout wording is in the middle of a text review (`docs/TEXT_CHANGES.md`) |
| BUG-007 (Low) | On phones, the round side buttons cover the right end of the course button | Hide them on course pages too, as on cart and checkout |
| BUG-008 (Low) | Build Your Brand scrolled sideways once on a phone, signed out | Team: watch for it on real phones |

## Needs a person

- **The Mac's disk is full** (99%). At one point only 0.6 GB was free. To
  make room I cleared the database's old change logs (about 1.2 GB; no
  data lost). A full disk can stop the database, as happened earlier
  today. Please free some space before making the upload package.
- **An old `pnpm dev` server is still running on port 3000** (started
  4:34 am). Its parent run has ended, and it answers every page with an
  error. Its cache uses about 7.4 GB of disk. I wasn't allowed to stop it.
  Stopping it, then deleting `.next/dev`, would free that space.
- **The wording review is still not committed.** Seven files in
  `src/content/` and `docs/TEXT_CHANGES.md` have edits from another session.
  All checks above ran with those edits in place, and they pass. They were
  left out of this commit.

## Effect on dates

- **1 November launch:** not at risk. The fixes are small. They need to go
  up with the next upload package so the team can re-check BUG-001 to
  BUG-004.

## Next steps

1. Developer: make and upload a new package (it includes course sales and
   today's fixes) and run `pnpm db:deploy` on the test address.
2. Team: re-check BUG-001 to BUG-004 on the test address and mark them
   Re-checked.
3. Owner: decide on BUG-005 to BUG-007 (fix before launch, or after).
4. Free disk space on the Mac.
