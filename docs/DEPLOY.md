# Deploying to Hostinger (private test address, then launch)

This is the checklist for putting the site on Hostinger. **A person does the
deploy; agents never deploy** (see CLAUDE.md). Plan:

1. **Today:** a private test address (for example `test.yourdomain.com`),
   behind a team password, with its own database.
2. **Team testing:** every account type, every main job, phone and computer.
3. **Fix and re-check** whatever the team finds.
4. **Before 1 November:** clear the test accounts and orders, set real stock
   and payment details.
5. **1 November:** the main address switches from "Coming soon" to the site.

Nothing here needs Razorpay or Shiprocket. Payment is by QR code or bank
transfer (see "Payments").

## What you need

- A Hostinger plan that runs **Node.js web apps** and has **MySQL**. In hPanel
  open _Websites > your site > Node.js_ (or "Node.js Apps") and check the
  list of Node versions. `package.json` asks for **Node 24 or newer**. If
  Hostinger tops out lower, stop and tell the developer before going on.
- The domain's DNS managed in Hostinger (or an A record you can add).
- Two separate things for the two addresses: **two apps and two databases**.
  The test address must never share a database with the main address.

## 1. The private test address

1. **Subdomain.** hPanel > _Domains > Subdomains_: create `test`. Turn on the
   free SSL (the padlock) for it, and switch on "Force HTTPS". Wait until
   `https://test.yourdomain.com` opens with the padlock before going on: the
   team password is sent in plain text without https.
2. **Database.** hPanel > _Databases > MySQL_: create a database and a user
   for the test address. Its name **must contain `test` or `staging`** (for
   example `u123456789_saatvik_test`): the site checks this when it starts,
   so the test address can never run on the live database. Write down the name,
   user, password and host. The connection string looks like
   `mysql://USER:PASSWORD@HOST:3306/DATABASE` (URL-encode special characters
   in the password).
3. **Node.js app** for the subdomain. Upload the code either from the GitHub
   repository (_Import Git repository_, branch chosen by the owner) or as the
   ZIP made by `scripts/package_for_hostinger.sh` (only committed files, no
   development files, secrets, uploads or local databases; it refuses to
   finish if any slip in). `--verify` also installs and builds the ZIP in a
   temporary folder. Contents and options: `docs/TEST_DEPLOY_STEPS.md` step 4a.
4. **Settings in the Node.js app screen:**
   - Framework: Next.js. Node version: 24 (or the newest at least 24).
   - Install: `pnpm install --frozen-lockfile --prod=false` (if pnpm is
     missing, `corepack enable` first). The build, the database commands and
     the admin script need the developer tools (TypeScript, Tailwind, Prisma,
     tsx), so do not skip them.
   - Build: `pnpm build`
   - Start: `pnpm start` (Hostinger passes the port; if it needs a flag, use
     `pnpm start --port $PORT`).
5. **Environment variables** (the table below), entered in the app's settings.
   Never commit them.
6. **Database setup**, once, from the Hostinger terminal/SSH or "Run script":
   ```
   pnpm db:deploy        # creates the tables (prisma migrate deploy)
   pnpm db:seed          # catalogue, content and settings
   pnpm admin:create     # the first admin; set ADMIN_EMAIL / ADMIN_PASSWORD first
   ```
   Then **delete `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`** from the
   server's variables. Never run `pnpm db:reset` or `prisma migrate dev` on a
   server: they wipe or reshape data.
7. **Real catalogue.** `pnpm db:seed:catalogue` loads the client's product list
   (159 products). Skip it if the seed already has what the team needs.
8. Start the app and open the address. The browser asks for the team user name
   and password (`STAGING_ACCESS_USER` / `STAGING_ACCESS_PASSWORD`). Share them
   with the team in a message, not in the repository.

### Environment variables

| Variable | Test address | Main address (live) |
| --- | --- | --- |
| `DATABASE_URL` | the test database (name contains `test` or `staging`) | the live database (different! name without `test` or `staging`) |
| `BETTER_AUTH_URL` | `https://test.yourdomain.com` | `https://yourdomain.com` |
| `BETTER_AUTH_SECRET` | a new random value (`openssl rand -base64 32`) | a different new random value |
| `STORAGE_DIR` | a folder on persistent disk **outside** the web folder | another such folder |
| `PAYMENT_PROVIDER` | `manual` | `manual` |
| `SHIPPING_PROVIDER` | `manual` (`test` also works: on a server it acts as `manual`) | `manual` until Shiprocket |
| `STAGING_ACCESS_USER` | `team` (or any name) | _leave unset_ |
| `STAGING_ACCESS_PASSWORD` | a long password | _leave unset_ |
| `SHOW_DESIGN_PAGE` | `false` | `false` |
| `DEV_SHOW_OTP` | `false` | `false` |
| `TEST_PAYMENTS_IN_LOCAL_BUILD`, `TEST_SHIPPING_IN_LOCAL_BUILD` | unset | unset |
| `APP_VERSION` | optional label shown in the error log | optional |

Never reuse the same `BETTER_AUTH_SECRET` on both addresses.

**Start-up check.** On a server the site checks its settings when it starts
(`src/server/site-check.ts`). If `BETTER_AUTH_URL` is missing or not https, or
the database name does not match the address (test address: name contains
`test` or `staging`; live site: it does not), every page shows an error and
the server log starts with "Site settings need fixing" and the reason. Fix the
variable and restart the app.

## 2. Payments (QR code or bank transfer)

`PAYMENT_PROVIDER=manual`. The customer places the order and then sees a
screen with a UPI QR code (amount and order number filled in), the UPI ID and
the bank details. The order shows "Waiting for payment" until an admin marks it
paid.

1. Admin > **Settings > Payment details (QR and bank)**: fill in the name, UPI
   ID, bank name, account number, IFSC and an optional note. Leave a field
   empty to hide it. With no UPI ID there is no QR code; with nothing filled in
   the customer is asked to call.
2. Admin > **Orders** > the order > **Mark as paid**, after checking the money
   arrived. That makes the invoice, takes the stock, credits coins and sends
   the confirmation, once.
3. **Stock is held for 30 minutes** while an order waits. If the customer pays
   later and the units were sold meanwhile, "Mark as paid" says an item ran out
   of stock and the order stays unpaid: sort it out by phone and refund by hand.
   Mark payments as soon as the money is seen.
4. Razorpay comes later (2 to 3 months). Checkout talks to a provider
   interface, so adding it does not change checkout.

## 3. Testing checklist for the team

Use the test address on a phone and a computer. Tick each line.

- [ ] **Doctor:** sign up (email + password), choose the doctor type, upload a
      document; an admin approves it in Admin > Approvals. The doctor opens
      Courses, **Dr. Talk** (starts a thread, replies, likes) and Quiz & Win.
- [ ] **Regular buyer:** browse Top Brands, add to cart, check out with an
      address, see the QR payment screen, the order shows "Waiting for
      payment"; the admin marks it paid; the buyer sees it paid and can track it.
- [ ] **Bulk buyer:** Build Your Brand, fill the Brand cart with a logo and
      label details, place the order, pay by QR; the admin follows the brand
      order stages and uploads a label proof.
- [ ] **Courses:** browse and open a course (buying courses uses the same cart).
- [ ] **Quizzes:** the firm creates a quiz in Admin; a user plays it and sees
      the leaderboard.
- [ ] **Firm staff:** every Admin page opens; orders, brand orders, inventory,
      settings, content and the error log work.
- [ ] No broken pages or errors at 375 px (phone) and 1280 px (computer). Use
      "Report a problem" in the site for anything found, and look at
      Admin > Errors.

## 4. Known limits on the test address

- **Phone-code (OTP) sign-in does not work** until an SMS provider is added
  (MSG91, chunk G.3). Everyone signs up and in with **email and password**.
  Codes are only shown on a developer machine, never on a server.
- **Emails do not go out** (verification, forgot-password, order messages):
  they print to the server log. If a tester is locked out, an admin resets
  them: re-run `pnpm admin:create` for admins, or delete the test account.
- **Shipping is by hand** until Shiprocket (G.2). Book the parcel with any
  courier, then in Admin > Orders > the order > **Shipment**, type the
  courier's name and tracking number (both optional; the order number is used
  if the tracking number is empty) and press **Create shipment**. Then press
  **Mark as: Packed**, **Shipped**, **In transit**, **Out for delivery** and
  **Delivered** as the parcel moves. The customer sees each step on their
  order page and gets a message. Brand orders are dispatched from their own
  page as before.
- **Uploaded files** (documents, logos, proofs, invoices) are saved in
  `STORAGE_DIR` on the server's disk. Keep that folder out of the web folder
  and include it in backups. Cloud storage (R2) comes later (G.4).

## 5. Security checks before opening to the team

- [ ] The padlock shows, and `http://` redirects to `https://`.
- [ ] A private window asks for the team password; a wrong one is refused.
- [ ] `https://test.yourdomain.com/design` shows a 404.
- [ ] The response headers include `Strict-Transport-Security` (the site sends
      it when `BETTER_AUTH_URL` is https) and `X-Robots-Tag: noindex`.
- [ ] `https://test.yourdomain.com/robots.txt` opens without the password
      and says `Disallow: /` (`src/proxy.ts`, only while the team password is
      set). Adding and removing testers, IP lists and search engines:
      `docs/ACCESS_CONTROL.md`.
- [ ] `.env`, `storage/` and the database are not reachable from the web.
- [ ] **Rate limits and the visitor's address.** The site reads the first
      `x-forwarded-for` entry (`src/server/request-origin.ts`, and Better Auth
      in `src/server/auth/index.ts`). Hostinger's proxy must overwrite that
      header. Test: send a request with a fake `X-Forwarded-For: 1.2.3.4` and
      check the proxy replaced it. If the proxy keeps the fake value, per-IP
      rate limits can be bypassed; tell the developer before launch.
- [ ] Back up the database (hPanel > Backups, or a daily `mysqldump`) and the
      `STORAGE_DIR` folder, and do one test restore.
- [ ] Turn on uptime monitoring for the address.

## 6. Before 1 November (clear and get ready)

1. Fix everything the team found; re-test each fix.
2. **Clear test data.** The live site gets its own new database (section 7),
   so test accounts and orders never reach it; the site refuses to start if
   the live address points at a database named like a test one. Clear the
   test database when testing ends (full steps and what it prints:
   `docs/LAUNCH_1_NOVEMBER.md` section 3):
   ```
   pnpm db:clear-test-data --dry-run   # only lists what it would remove
   pnpm db:clear-test-data --delete    # asks you to type the database name, then removes it
   ```
   It removes all orders, invoices, quiz attempts, coins, notifications, bug
   reports, error log entries and every non-admin account (with their carts,
   threads and uploaded files), and gives back stock held by unpaid orders.
   It keeps admins, the catalogue, quizzes, courses, content and settings. It
   does **not** put back stock that paid test orders took: set the real stock
   in Admin > Inventory afterwards. It refuses to run unless the database name
   contains `test` or `staging` and the settings are the test address's, so
   it can't be used on the live site.
3. Admin > Settings: payment details, seller details (legal name, address,
   GSTIN for invoices), phone number, delivery fee, discount. Turn off any
   announcement used for testing.
4. Admin accounts: strong passwords, two-factor set up for each.

## 7. 1 November: the main address

The full launch-day plan (checklists, who does what, timings and rollback) is
`docs/LAUNCH_1_NOVEMBER.md`. Summary:

Until then the main address keeps its "Coming soon" page. To switch:

1. Create the live app and live database for the main domain (as in section 1,
   with the live column of the table: no `STAGING_ACCESS_*`, new secret,
   `BETTER_AUTH_URL=https://yourdomain.com`).
2. Run `pnpm db:deploy`, `pnpm db:seed`, `pnpm admin:create`, then the
   settings in section 6.
3. If you want the live site up a little early, switch on **Admin > Settings >
   Maintenance mode** with a "Coming soon" message: visitors see a plain
   page, admins see the whole site. Switch it **off** on launch day.
4. On the day, point the main domain at the new app (or switch off maintenance
   mode), open the address and walk through one order and one sign-in.
5. Check the padlock and the headers again, and remove the "Coming soon" page.

## Smoke test after any deploy

On the address, in order: the homepage loads; a product page loads; the
sign-in window opens; sign in as an admin and open Admin > Orders; place one
test order and see the QR screen; `/design` is a 404. Remember that orders made
on the live site are real: do the order test on the test address only.
