# Set up the live site now, open it on launch day

The live app can be put on the main address **while team testing goes on**.
Visitors see a "Coming soon" page; signed-in admins see the whole site and can
fill in the real settings. On launch day you only remove one setting and
redeploy.

A person does these steps in hPanel; agents never deploy (CLAUDE.md).

## How the branches map to the two addresses

| Branch on GitHub | Hostinger app | Address |
| --- | --- | --- |
| `staging` | the test app | `staging.saatvikvaidya.in` |
| `main` | the live app (new) | the main address, e.g. `saatvikvaidya.in` |

Fixes from testing go to `staging` first. When they are checked, `staging` is
merged into `main` and Hostinger rebuilds the live app. While
`SITE_COMING_SOON=true` the live address keeps showing "Coming soon", so a
merge never opens the site by accident.

## 1. Before you start

- Back up the current "Coming soon" page in the main domain's `public_html`
  (File Manager > select all > Compress > Download). The new app replaces it.
- Have the main domain's padlock (SSL) on, with "Force HTTPS".

## 2. A new, empty live database

hPanel > Databases > MySQL: create a database and user for the live site.
The name **must not contain `test` or `staging`** (for example
`u123456789_saatvik`); the site refuses to start otherwise. Never point the
live app at the test database: test accounts and orders would go live.

## 3. The live Node.js app

hPanel > Websites > the main domain > Node.js > Import Git repository:

| Box | Value |
| --- | --- |
| Repository | `Tusshar420/saatvikVaidya` |
| Branch | `main` |
| Framework | Next.js |
| Node version | 24 |
| Build command | `pnpm run build:hostinger` |
| Output directory | `.next` |

## 4. Settings (environment variables) for the live app

| Variable | Value |
| --- | --- |
| `SITE_COMING_SOON` | `true` (**keep until launch day**) |
| `DATABASE_URL` | the live database from step 2: `mysql://USER:PASSWORD@HOST:3306/DATABASE` |
| `BETTER_AUTH_URL` | `https://saatvikvaidya.in` (the main address, with https) |
| `BETTER_AUTH_SECRET` | a **new** random value, not the test app's (`openssl rand -base64 32`) |
| `STORAGE_DIR` | a folder outside the web folder, different from the test app's |
| `PAYMENT_PROVIDER` | `manual` |
| `SHIPPING_PROVIDER` | `manual` |
| `SHOW_DESIGN_PAGE` | `false` |
| `DEV_SHOW_OTP` | `false` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | the first admin; **delete after the first sign-in** |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | `smtp.hostinger.com`, `465`, a mailbox on the main domain (e.g. `no-reply@saatvikvaidya.in`) |
| `STAGING_ACCESS_USER`, `STAGING_ACCESS_PASSWORD` | **leave out** (they mark the test address) |

Deploy. The build creates the tables, loads the settings, content and the
product list, and creates the admin (`scripts/hostinger-start.mjs`).

## 5. Check it, then get it ready

1. Open the main address in a private window: the "Coming soon" page shows,
   with the call button and "Admin sign-in".
2. Sign in as the admin: the whole site shows. Set up two-factor sign-in.
3. Delete the `ADMIN_` settings and redeploy.
4. Admin > Settings: payment details (UPI ID, QR, bank), seller details for
   invoices, phone number, delivery fee. Admin > Inventory: real stock.
   Maintenance mode shows as locked on while `SITE_COMING_SOON` is set.
5. Don't place orders here: orders on the live site are real. Test on the
   test address.

## 6. After testing: move the fixes over

On GitHub, open a pull request from `staging` to `main` and merge it. Hostinger
rebuilds the live app. It still shows "Coming soon".

## 7. Launch day

1. Live app settings: delete `SITE_COMING_SOON` (or set it to `false`) and
   redeploy.
2. Admin > Settings: make sure Maintenance mode is off.
3. Open the main address in a private window: the full site shows. Do the
   smoke test in `docs/DEPLOY.md` (no real order).

To close the site again quickly, set `SITE_COMING_SOON=true` and redeploy, or
switch Maintenance mode on in Admin > Settings (no redeploy needed).
