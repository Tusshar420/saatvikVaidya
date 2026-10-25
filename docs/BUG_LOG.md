# Bug log: Saatvik Vaidya test address

One shared list of every problem found while testing. Add a row for each new
problem. Don't delete rows: change the **Status** instead.

The tests to run are in `docs/TEST_PLAN.md`. Last day to fix and re-check
problems: **31 October 2026**.

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

All rows must be **Re-checked** before launch on 1 November. If a fix
doesn't work, set the row back to **Open** and add a note.

---

## Bugs

| ID | Page | What happened | Steps | Device and browser | Severity | Status | Fixed by | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | | | | | | Open | | |
| BUG-002 | | | | | | Open | | |
| BUG-003 | | | | | | Open | | |
| BUG-004 | | | | | | Open | | |
| BUG-005 | | | | | | Open | | |
| BUG-006 | | | | | | Open | | |
| BUG-007 | | | | | | Open | | |
| BUG-008 | | | | | | Open | | |
| BUG-009 | | | | | | Open | | |
| BUG-010 | | | | | | Open | | |

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
