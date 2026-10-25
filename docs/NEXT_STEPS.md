# Next steps for the owner

Written 25 October 2026 after the tech lead's final review. This page is the
short list. Each step points to the guide that has the detail.

**Where things stand:** the site is ready for team testing. It is not yet
proven ready to launch, because nobody has opened it on the real test address
yet. Nothing found puts 1 November at risk, but every step below has to
happen on time.

**Two things to settle first**

1. **Launch date.** The project brief says **1 November**. The project
   timeline says **6 November**. This plan aims for 1 November and keeps 6
   November as the back-stop if the go/no-go check says "no". Please confirm.
2. **Hostinger plan.** The site is a Node.js app that needs **Node 24**. If
   your plan has no Node.js option, or only offers a version below 24, tell
   the developer today. Changing plans takes days. (Step A1.)

Replace `yourdomain.com` with your real domain in every guide.

---

## A. Today (Sunday 25 October): put the site on the test address

Guide: `docs/TEST_DEPLOY_STEPS.md`. About 1 to 2 hours, plus waiting for the
padlock.

| # | What to do | Guide step |
| --- | --- | --- |
| A1 | In hPanel, check the plan can run a Node.js app on Node 24. Start the form, don't finish it. | Step 0 |
| A2 | Developer: read the 7 changed files in `src/content/` and `docs/TEXT_CHANGES.md` (wording only). Commit them or drop them. **The ZIP only holds committed files.** | - |
| A3 | Developer: make the ZIP: `git switch dev && scripts/package_for_hostinger.sh --out ~/Desktop`. It must end with `Done. Nothing was uploaded.` The ZIP in `dist/hostinger` is old; don't use it. | Step 4a |
| A4 | Create the subdomain `test.yourdomain.com`. | Step 1 |
| A5 | Switch on free HTTPS (the padlock) and Force HTTPS for it. Don't share the address until the padlock shows. | Step 2 |
| A6 | Create the **test** database. Its name must contain `test`. | Step 3 |
| A7 | Make a new secret key (`openssl rand -base64 32`), the team password and the first admin login. Keep them in a password manager only. | Step 4b to 4d |
| A8 | Create the Node.js app for **`test.yourdomain.com` only**. Upload the ZIP. Never attach it to the main address. | Step 5 |
| A9 | Make the uploads folder outside the website folder, then write `.env.local` (with `PAYMENT_PROVIDER="request"` and the team password). | Step 6 |
| A10 | In the server terminal run, one at a time: `pnpm db:deploy`, `pnpm db:seed`, `pnpm db:seed:catalogue`, `pnpm admin:create`. Then delete the three `ADMIN_...` lines and restart. | Step 7 |
| A11 | Tick the whole final checklist, in a private window and on a phone using mobile data. Ask one person outside the team to confirm they only see the password box. | Step 9 |
| A12 | Check the main address still shows **Coming soon**, with no password box. | `docs/ACCESS_CONTROL.md` section 1 |
| A13 | Place one test order on the test site. The screen must say "Your order is received" and show **no** QR code or bank details. In Admin > Orders, open it and check **Mark as paid** works. | Step 9 |
| A14 | Send the address and team password **privately** to each tester. Start them on `docs/TEAM_TESTING_GUIDE.md` and `docs/TEST_PLAN.md`. | `docs/ACCESS_CONTROL.md` section 2 |

Stop and call the developer if: the build is "killed" or out of memory, there
is no `pnpm`, or the site opens with no password box.

**Housekeeping on the Mac (any time today):** an old `pnpm dev` (process 7481,
port 3000) is still running and holds a very large cache. Stop it by hand.
The disk was at 99% earlier today.

---

## B. Testing week (Monday 26 to Saturday 31 October)

| When | What | Who |
| --- | --- | --- |
| Mon 26 to Thu 29 Oct | Testers run `docs/TEST_PLAN.md` on the test address, on real phones and computers. Every problem goes in `docs/BUG_LOG.md` from **BUG-009** on. Don't type passwords into the log. | Testers |
| Same days | Developer fixes in order: High first, same day. Put each fix on the test address (new ZIP, **Redeploy**). The finder tries the same steps again and sets the row to **Re-checked**. | Developer, testers |
| Also in the test plan | Try the ebook "Waiting for your payment" state by hand (BUG-005 has only a unit test). | Tester |
| Wed 28 Oct (about) | Look at `site:test.yourdomain.com` in Google later in the week: nothing should be listed. | Owner |
| **Thu 29 Oct** | **Owner decisions** (`docs/LAUNCH_1_NOVEMBER.md` section 2): launch with no "forgot password" emails? OTP sign-in off? No order emails? Courier details by hand? Is the main address with or without `www`? Also confirm the 1 or 6 November date. If any answer is "no", tell the developer the same day. | Owner |
| **Thu 29 Oct** | Team testing finished and the line-by-line checklist in `docs/DEPLOY.md` section 3 is ticked. | Project manager |
| **Fri 30 Oct** | Last day to fix and re-check. Every BUG row must read **Re-checked**. Then the version is frozen: developer runs `scripts/package_for_hostinger.sh --verify` (ends with `Check passed`) and writes down the commit id. | Developer |
| Fri 30 Oct | Prepare (nothing visible changes): back up the Coming soon page, ask Hostinger support how to put a Node.js app on the main address and how to restore the old page, create the **live** database (no `test` in its name) and live uploads folder, make a **new** secret key, choose the live admin, lower the DNS TTL to 300 if the domain is not at Hostinger, firm admin gathers payment details, seller details and GSTIN, real stock, support phone. | Owner, firm admin |
| **Sat 31 Oct** | Save any bug reports you want to keep (the clean-up removes them). On the **test** terminal run `pnpm db:clear-test-data --dry-run`, check the first line shows the **test** database, then `pnpm db:clear-test-data --delete` and type the database name. Run the dry run again: accounts, orders and attempts should be 0. Remove admin accounts made only for testing. | Owner, developer |
| **Sat 31 Oct** | **Go / no-go meeting.** Write down Go or No go, the time and who agreed. If "no go", pick a new day no later than Friday 6 November. | Project manager, owner, developer, firm admin |

---

## C. Sunday 1 November (07:00 to about 11:00 India time)

Guide: `docs/LAUNCH_1_NOVEMBER.md` sections 5 and 6. Owner and developer must
both be reachable from 07:00 to 14:00. Use a private group chat; never post
passwords in it.

| Time | What |
| --- | --- |
| 07:00 | Make the ZIP of the frozen version. Check `PACKAGE_INFO.txt` shows the agreed commit id. |
| 07:15 | Attach a **new** Node.js app to `yourdomain.com`, with the live settings file. The live file has **no** `STAGING_ACCESS_...` lines, a new database, a new secret key and `PAYMENT_PROVIDER="request"`. Deploy. |
| 07:45 | Run `pnpm db:deploy`, `db:seed`, `db:seed:catalogue`, `admin:create`. Delete the `ADMIN_...` lines, restart, sign in, and at once switch **Admin > Settings > Maintenance mode: On**. |
| 07:45 to 08:15 | HTTPS Active for `yourdomain.com` and `www`. Force HTTPS. Forward `www` to the main address (or the other way round). |
| 08:15 | Firm admin fills in Settings (payment details, seller details, phone, delivery fee), real stock, staff admins and first quiz. |
| 09:00 | Testers run the launch-day checks on a phone and a computer. One rehearsal order: see the "order received" screen. Cancel it and delete the testers' accounts by hand (the clear script refuses to run on the live site, on purpose). |
| about 10:30 | Go / no-go. If go: **Maintenance mode: Off**. Check in a private window. Add the address to the uptime checker. Project manager tells the firm and the team. |
| Evening | Take a database and uploads backup. Watch Admin > Orders and Admin > Errors. Keep the Coming soon backup until at least 15 November. |

**If it goes wrong:** Maintenance mode On brings the "back soon" page back in
one minute. Only if the app won't start at all, restore the Coming soon page
(`docs/LAUNCH_1_NOVEMBER.md` section 7). Never delete the live database.
Next try no later than Friday 6 November.

**After launch:** the test address keeps its team password and stays private.
Keep the rest of the Done list: main address shows the full site, "Coming
soon" is gone.

---

## D. Adding Razorpay later (planned 2 to 3 months after launch)

Not part of this launch. **Do not add it now.** The checkout is built so it
can be added without redoing it:

- Checkout only talks to a small "payment provider" interface
  (`src/server/payments/types.ts`). It has four jobs: `isAvailable`,
  `createPayment`, `verifyPayment` and `refundPayment`.
- Today there are three providers: `request` (no payment options; the team calls the customer, an admin marks the order paid; used on the test address and the live site), `manual` (QR or bank transfer, an admin marks
  the order paid; used on the test address and the live site) and `test`
  (practice screen; it refuses to run on a real server).
- Each payment records which provider took it, so older QR payments and
  refunds keep working after the switch.

What a future ticket does:

1. Add one new file, `razorpay-provider.ts`, and list it in
   `src/server/payments/index.ts` and in `PaymentProviderName`. It creates a
   Razorpay order in `createPayment` and checks Razorpay's signature (and a
   webhook) in `verifyPayment`.
2. Add the Razorpay keys as new settings, only in `.env.local` on the server
   and in `.env.example` as empty placeholders. Never commit them.
3. Try it on the test address with Razorpay's own test keys first, then with
   real keys on the live site, then set `PAYMENT_PROVIDER="razorpay"`.
4. Keep QR and bank transfer as a fallback until the team is happy.

The owner's part is to open a Razorpay account and finish its business
checks. That takes time, so start it before the ticket does.

---

## What the tech lead's review found

- **The five guides agree with each other and the code** on commands, setting
  names, the team password lock, the database-name safety check, Maintenance
  mode as the quick rollback, and the clear-test-data tool and its flags.
- **Two disagreements were fixed:**
  - The bug log and readiness report said fixes could run to 31 October, but
    the launch plan freezes the version on 29 to 30 October. Both now say
    testing ends 29 October and the last fix day is 30 October.
  - The launch plan said courses can't be bought yet. They can (BUG-002 and
    the course-sales migration). The line is corrected.
- **Secrets:** no secrets file is saved in git. `.env.local` is ignored; only
  `.env.example` (placeholders) is saved. The packaging script refuses to
  build a ZIP that holds a secrets file, a database dump, or any value from
  your `.env.local`.
- **Deploys and money:** every step that changes a server is written for a
  person to do in hPanel. The packaging script only reads the project and
  writes a ZIP; it uploads nothing. Payment is `manual` (no money moves in
  the code) and shipping is `test`. No gateway is connected.
- **Not checked in this review:** a full search through the code and git
  history for secret-looking strings, and for Razorpay or Shiprocket code
  (the search was blocked while the owner was away). The packaging script
  repeats the secrets check on every ZIP. The developer should run
  `git grep -nIiE 'razorpay|shiprocket|rzp_|BEGIN .*PRIVATE KEY'` once
  before step A3.
- **Still open from the readiness report:** the real test address has not
  been opened; the QR has not been scanned in a real UPI app; the clear-test-
  data tool has not been run on a real database; real phones, Safari and
  Firefox are untried.
