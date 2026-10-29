# Bug log: Saatvik Vaidya test address

One shared list of every problem found while testing. Add a row for each new
problem. Don't delete rows: change the **Status** instead.

The tests to run are in `docs/TEST_PLAN.md`. Last day to fix and re-check
problems: **30 October 2026**. Team testing ends on 29 October; the final
version is frozen after the fixes are re-checked (`docs/LAUNCH_1_NOVEMBER.md`
section 2).

---

## How to fill in a row

| Column | What to write | Example |
| --- | --- | --- |
| **ID** | The next number: BUG-001, BUG-002, … | BUG-007 |
| **Page** | The page name and its address (copy it from the address bar). Add the test number from the test plan if there is one. | Cart, `/cart` (test 6.5) |
| **What happened** | One or two sentences: what you expected, and what you saw instead. | Expected the total to drop after removing a product. It stayed at ₹1,240. |
| **Steps** | Numbered steps someone else can follow to see the same problem. Start from a page anyone can open. | 1) Sign in as a buyer. 2) Add 2 products. 3) Open the cart. 4) Tap Remove on one. |
| **Device and browser** | The phone or computer, and the browser. | iPhone 13, Safari |
| **Severity** | High, Medium or Low (see below). | High |
| **Status** | Open, Fixed or Re-checked (see below). | Open |
| **Fixed by** | Who fixed it, and the date. Leave empty while Open. | Tushar, 28 Oct |
| **Screenshot** | The file name of the screenshot, or "sent on WhatsApp". | BUG-007.png |

**Severity**

- **High:** stops a main job, or loses or shows the wrong data. For example:
  can't sign in, can't place an order, wrong price or amount, wrong UPI ID,
  an error page, someone else's order is shown. Tell the developer the same
  day.
- **Medium:** a job still works but is hard or confusing. For example: a
  button is hidden on a phone, a wrong message, a page needs sideways
  scrolling.
- **Low:** looks wrong but doesn't get in the way. For example: a spelling
  mistake, text slightly out of line, a faded picture.

**Status**

- **Open:** found, not fixed yet.
- **Fixed:** the developer has fixed it and put the fix on the test address.
- **Re-checked:** the person who found it tried the same steps again, on the
  same device, and it now works. Only the finder (or another tester) moves a
  row to Re-checked, not the person who fixed it.

All rows must be **Re-checked** by 30 October, before launch on 1 November. If a fix
doesn't work, set the row back to **Open** and add a note.

---

## Bugs

BUG-001 to BUG-008 come from the QA check on 25 October (see
`docs/test-report.md`). BUG-001 to BUG-008 were re-checked locally by QA on 25 Oct (see
`docs/READINESS_REPORT.md`); a team member should still try the steps once on
the test address. Team members: start your
rows at BUG-009.

| ID | Page | What happened | Steps | Device and browser | Severity | Status | Fixed by | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | Pay for your order, `/checkout/pay/…` | Expected the cart to be empty after tapping Place order (QR / bank transfer). It still held the products, and the cart icon still showed a number until staff marked the order paid, hours later. A buyer could think the order failed and order again. | 1) Sign in as a regular buyer. 2) Add any product to the cart. 3) Check out and tap Place order. 4) Look at the cart icon, or open the cart. | Test browser (Chrome), phone 375 px and computer 1280 px | Medium | Re-checked | QA check, 25 Oct Re-checked 25 Oct (QA, local, phone and computer): cart empty after Place order; manual-payment e2e passes. | none |
| BUG-002 | Course page, `/courses/…` | After ordering a course by QR, and before staff confirmed the payment, the course page offered Enrol again (before BUG-001's fix it said "In your cart"). A buyer could order and pay for the same course twice. It now says "Waiting for your payment" with a See how to pay button. | 1) Sign in as a regular buyer. 2) Open a course with a price and tap Enrol. 3) Check out and tap Place order. 4) Open the same course page again. | Test browser (Chrome), phone 375 px and computer 1280 px | Medium | Re-checked | QA check, 25 Oct Re-checked 25 Oct (QA, local): course page shows Waiting for your payment, then enrolled after Mark as paid; courses e2e passes. | none |
| BUG-003 | Pay for your order, `/checkout/pay/…` | The only link under the QR and bank details was "Back to cart", which led to an empty cart once BUG-001 was fixed. It is now "View my orders". | 1) Place any order (not a brand order). 2) Scroll to the bottom of the pay screen. | Test browser (Chrome), phone 375 px and computer 1280 px | Low | Re-checked | QA check, 25 Oct Re-checked 25 Oct (QA, local): pay screen ends with View my orders (manual-payment e2e). | none |
| BUG-004 | Course page, How to join | The meeting link in the joining details (for example a Zoom link) was plain text, so on a phone the buyer had to copy it by hand. Web links there can now be tapped. | 1) Buy a course whose joining details include a link, and have it marked paid. 2) Open the course page. 3) Tap the link. | Test browser (Chrome), phone 375 px and computer 1280 px | Low | Re-checked | QA check, 25 Oct Re-checked 25 Oct (QA, local): joining link is a tappable link (courses e2e). | none |
| BUG-005 | Ebook page, `/ebooks/…` | Same risk as BUG-002, for paid ebooks: while an ebook order waits for payment, the page still shows Add to cart, so the same ebook can be ordered twice. The page has no "in your cart" or "waiting for payment" state. | 1) Sign in as a regular buyer. 2) Add a paid ebook to the cart, check out and tap Place order. 3) Open the same ebook page. | Test browser (Chrome), phone 375 px and computer 1280 px | Medium | Re-checked | Backend developer, 25 Oct. The ebook page now looks up the buyer's unpaid order and shows "Waiting for your payment" with a See how to pay button instead of Add to cart (same as courses). Test added. Re-checked 25 Oct (QA, local) by the ebooks unit test only; no browser test for the ebook page exists. Try it by hand once on the test address. | none |
| BUG-006 | Checkout, `/checkout`, with only a course in the cart | The heading says "Where should we deliver?" and asks for a delivery address, though an online course has nothing to deliver. (The address is used for the GST invoice.) Confusing wording, not a blocker. | 1) Put only a course in the cart. 2) Open checkout. | Test browser (Chrome), phone 375 px and computer 1280 px | Low | Re-checked | Frontend developer, 25 Oct. When the cart has only courses or ebooks, the heading now says "Where should we send the invoice?" and the box says "Billing address (for your invoice)". Re-checked 25 Oct (QA, local): course-only checkout now says "Where should we send the invoice?"; new check added to courses e2e. | none |
| BUG-007 | Course page, on a phone | The round Feedback and WhatsApp buttons on the right edge cover the right end of the main button (Enrol, Go to cart or See how to pay). The button still works. | 1) On a phone, open any course page with a price. 2) Look at the right end of the orange button. | Test browser (Chrome), phone 375 px | Low | Re-checked | Frontend developer, 25 Oct. On phones the course buy buttons are 28 px narrower, so the side buttons no longer cover them. Re-checked 25 Oct (QA, local, 375 px): nothing covers the right end of Enrol; new check added to courses e2e. | none |
| BUG-008 | Build Your Brand, `/launch`, signed out, on a phone | Once, the page could be pushed sideways by about 80 px just after it opened. It did not happen again in 12 more tries. Probably a moment while the page loads. | 1) On a phone, signed out, open several pages one after the other, then Build Your Brand. 2) Try to drag the page sideways. | Test browser (Chrome), phone 375 px | Low | Re-checked | Frontend developer, 25 Oct. Could not repeat it; the page can no longer scroll sideways (overflow-x: clip). New test checks 12 pages at 360, 390, 414, 768 and 1280 px: no sideways scroll, no console errors. Re-checked 25 Oct (QA). The first fix did NOT work: the width test failed on /launch (page 80 px too wide) in every full phone run. Cause: the signed-out intro block was one grid column that grew with its content. Fixed with grid-cols-1 and min-w-0 in launch/page.tsx and launch-studio.tsx. Width test now passes in the full run. | none |
| BUG-009 | | | | | | Open | | |
| BUG-010 | | | | | | Open | | |
| BUG-011 | | | | | | Open | | |
| BUG-012 | | | | | | Open | | |

Need more rows? Copy the last row and change the ID.

---

## How to describe a problem clearly

Write it so that someone who wasn't there can see the same problem in two
minutes.

1. **One problem per row.** If two things went wrong, make two rows.
2. **Say what you expected and what happened.** "The cart is broken" is hard
   to fix. "I removed a product, but the total stayed at ₹1,240" is easy.
3. **Give the steps from the start.** Begin with which account you used
   (doctor, regular buyer, bulk buyer or staff) and which page you opened.
   Then each tap, in order.
4. **Copy any message word for word.** If the site shows an error or a red
   message, type it exactly, or make sure it is in the screenshot.
5. **Try it once more.** Does it happen every time, or only sometimes? Write
   "every time" or "1 in 3 tries".
6. **Write down the device and browser.** Many problems only happen on one
   phone or one browser.
7. **Never write a password** (yours, the team password or a test account's)
   in the log or in a screenshot.

**A good example**

> **Page:** Pay for your order, order SV-7K2Q9F4M (test 8.2)
> **What happened:** The IFSC code on the pay screen is HDFC000123. Staff
> typed HDFC0001234 in Settings. The last digit is missing.
> **Steps:** 1) Sign in as a regular buyer. 2) Add any product to the cart.
> 3) Check out and tap Place order. 4) Look at the bank details.
> **Device and browser:** Samsung Galaxy A52, Chrome. Same on a laptop.
> **Severity:** High.

**A poor example**

> Payment page wrong.

---

## How to take a screenshot

Take the screenshot **while the problem is on the screen**, before you tap
anything else. Make sure the message or the wrong part is visible. If you
can, include the address bar at the top.

| Device | How |
| --- | --- |
| iPhone with Face ID | Press the **side button** and **volume up** together. |
| iPhone with a Home button | Press the **side (or top) button** and the **Home button** together. |
| Android phone | Press **power** and **volume down** together. (On some Samsung phones you can also swipe the edge of your hand across the screen.) |
| iPad | Press the **top button** and **volume up** together (or **top** and **Home** on older iPads). |
| Windows computer | Press **Windows + Shift + S**, drag a box around the problem, then paste it (Ctrl + V) into your message. Or press **PrtScn**. |
| Mac | Press **Cmd + Shift + 4** and drag a box around the problem. The picture is saved on the desktop. **Cmd + Shift + 3** takes the whole screen. |

**Then:**

- Name the file with the bug ID, for example `BUG-007.png`, and write that
  name in the **Screenshot** column.
- Send it to the developer in the team chat, or attach it in **Report a
  problem** on the site (account menu, or the speech-bubble button at the
  side of the page). That form takes a PNG, JPEG or WebP picture up to
  5 MB. Still add a row to this log.
- If the problem is something moving (a button that jumps, a timer that
  resets), a short **screen recording** helps even more. iPhone: Control
  Centre → Screen Recording. Android: Quick settings → Screen recorder.
- Before sending, cover or crop out any password, phone number or bank
  detail that isn't part of the problem.
