# Launch day plan: 1 November 2026

How to switch the main address (`yourdomain.com`) from the "Coming soon" page
to the full website on **Sunday 1 November 2026**, and how to undo it quickly
if something goes wrong. Written 25 October 2026.

- **A person does every step here, in hPanel** (Hostinger's control panel).
  Agents and scripts never touch the live server.
- **Replace `yourdomain.com`** everywhere with the real domain.
- The test address is already described in `docs/TEST_DEPLOY_STEPS.md`
  (owner's guide) and `docs/DEPLOY.md` (developer's version). This plan uses
  the same steps for the main address and points to them instead of repeating
  them.
- **Back-stop date:** the launch deadline is **Friday 6 November**. If the
  go/no-go check on 31 October or 1 November says "no", we fix and try again
  on a later day that week. Don't launch a broken site to keep the 1 November
  date.

## The plan in one paragraph

The test address keeps running for the team. The main address gets a
**brand new app and a brand new, empty database**, so no test account or test
order can reach it. On the morning of 1 November, in a quiet window, the owner
attaches the new app to the main address, sets up the database, and at once
switches on the site's **Maintenance mode**, so visitors still see a "back
soon" page while the team checks everything. When every check passes, the
owner switches Maintenance mode off and the site is open. **Undoing it takes
one minute:** switch Maintenance mode back on. If the app itself won't run,
the older Coming soon page is put back from the backup made the day before.

---

## 1. Who does what

Fill in the names before 30 October. One person can hold more than one role,
but the **owner** and the **developer** must both be reachable from 07:00 to
14:00 on 1 November.

| Role | Who | What they do on launch day |
| --- | --- | --- |
| **Owner** | | Has the hPanel login. Makes every change in hPanel (app, domain, SSL, settings file, terminal commands). Makes the final "go" or "roll back" call together with the project manager. |
| **Developer** (on call) | | Reads the app's log in hPanel if anything fails, explains errors, decides fixes. Does not log in to the server unless the owner asks and is watching. |
| **Firm admin** (Satvik Vaidya staff) | | Signs in as admin. Fills in Admin > Settings (payment details, seller details, phone, delivery fee), sets real stock, checks the shop looks right. After opening: watches new orders and marks payments. |
| **Testers** (2 or 3 people from the team) | | Do the launch-day checks in section 6 on a phone **and** a computer, and report anything odd straight away. |
| **Project manager** | | Runs the go/no-go checklists (sections 2 and 6), keeps the timeline, tells the team and the firm when the site is open or rolled back. |

**One channel for the day:** a private group chat for these people only.
Never post passwords, the settings file or database details in it.

---

## 2. Before-launch checklist

### By Thursday 29 October: team testing finished

- [ ] Every line of the team testing checklist (`docs/DEPLOY.md` section 3)
      is ticked on the test address, on a phone and a computer.
- [ ] Every problem the team found is fixed **and re-checked** on the test
      address. Admin > Errors (errors and bug reports) has nothing open that
      blocks a customer.
- [ ] The final version is saved (committed) on `dev`, and the developer has
      run `scripts/package_for_hostinger.sh --verify` on it (ends with
      `Check passed`). Write down the commit id here: `________`.
- [ ] The test address runs this exact version.

### Decisions the owner must make by Thursday 29 October

These are not bugs. They are things that **don't work on any server yet**,
and customers will notice them on the live site:

- [ ] **"Forgot password" emails don't go out** (no email provider yet). A
      customer who forgets their password can't reset it themselves. Decide:
      launch anyway, with staff helping by phone, or add an email provider
      first (Hostinger mail or another; a separate ticket, and it takes time).
- [ ] **Phone-code (OTP) sign-in doesn't work** (no SMS provider yet).
      Customers sign up and sign in with email and password. Check on the
      test address what a customer sees if they try the phone option, and
      decide whether that is acceptable for launch.
- [ ] **Order and payment messages are not emailed.** Customers see their
      order status on the site (My Orders). Staff confirm by phone or
      WhatsApp if needed.
- [ ] **Delivery tracking steps** wait for Shiprocket. Staff share courier
      details by hand.
- [ ] **Which address is the main one:** `yourdomain.com` (recommended) or
      `www.yourdomain.com`. Sign-in only works on the one written in
      `BETTER_AUTH_URL`, so the other must forward to it (section 5, step 4).

If any of these is a "no" for the owner, tell the developer by 29 October:
it may move the launch towards the 6 November back-stop.

### Friday 30 October: prepare (nothing visible changes)

- [ ] **Find out how the Coming soon page is hosted** and write it down: a
      plain page in `public_html`, Hostinger Website Builder, WordPress, or
      something else. This decides how fast a full rollback is (section 7).
- [ ] **Back up the Coming soon page.**
      - Plain files: hPanel > File Manager > the main domain's `public_html`
        folder > select all > **Compress** to a ZIP > **Download** it. Keep
        the ZIP on the owner's computer and in a second safe place.
      - Website Builder or WordPress: take a backup in hPanel > Backups, and
        save a screenshot of the page and its text, so it can be rebuilt if
        needed.
- [ ] **Check how hPanel adds a Node.js app to a domain that already has a
      website.** Start _Websites > Add website > Node.js Apps_, see whether
      `yourdomain.com` is offered and what hPanel says (for example "this
      domain already has a website, remove it first"). **Don't finish the
      form.** If it isn't clear, ask Hostinger support chat: "How do I replace
      the existing site on my main domain with a Node.js app, and can I put
      the old site back afterwards?" Write down the answer.
- [ ] **Check the plan has room for a second app:** disk space and the file
      count limit ("inodes"). Risk 5 in `docs/SITE_OVERVIEW.md`.
- [ ] **Create the live database** (hPanel > Databases), as in
      `docs/TEST_DEPLOY_STEPS.md` step 3, but:
      - name **without** `test` or `staging`, for example `saatvik_live`
        (the site refuses to start if a live address uses a test-named
        database);
      - a **new** user and a **new** password (letters and numbers only).
- [ ] **Create the live uploads folder** at the top of the account, outside
      any website folder, for example `/home/u123456789/saatvik-live-uploads`
      (as in `docs/TEST_DEPLOY_STEPS.md` step 6a).
- [ ] **Make a new secret key** for the live site:
      `openssl rand -base64 32` on the Mac. It must be different from the test
      one.
- [ ] **Choose the live admin login** (email and a strong password of at
      least 12 characters). Use a real staff email, not a test one.
- [ ] **Write the live settings file** in the password manager, ready to
      paste (section 4). Don't put it on the server yet.
- [ ] **If the domain's DNS is not managed by Hostinger** (for example at
      GoDaddy): note the current records, then lower the **TTL** (how long
      other computers remember the address) of the `@` and `www` records to
      300 seconds. Then a change on 1 November takes minutes, not hours.
- [ ] **Firm admin has ready:** real UPI ID and bank details, seller legal
      name, address and GSTIN (for invoices), support phone number, delivery
      fee, opening discount (if any), real stock count per product.
- [ ] **Uptime monitoring** account ready (any free uptime checker), to add
      the main address once it is open.

### Saturday 31 October: clear the test data and confirm "go"

- [ ] The team stops testing on the test address.
- [ ] **Clear the test accounts and orders** (section 3).
- [ ] **Go/no-go meeting** (project manager, owner, developer, firm admin):
      - every box above is ticked;
      - the decisions above are made;
      - the people in section 1 are free on Sunday morning.

      Write down: **Go / No go**, time, who agreed. If "no go", pick a new day
      before 6 November and tell the firm.

---

## 3. Clearing the test accounts and orders

### Why the live site starts clean anyway

The main address gets **its own new database** (section 2). Nothing from
testing is copied across, and the site refuses to start if the main address
points at a database whose name contains `test` or `staging`. So test
accounts and test orders **can't** appear on the live site, as long as the
live database is new.

### Clearing the test address (Saturday 31 October)

The test address keeps running after launch, for future testing, so it is
emptied rather than deleted. The tool for this is `pnpm db:clear-test-data`
(the code is `scripts/clear-test-data.ts`).

**What it removes:** every order (store and Launch Your Brand, with their
payments, invoices and delivery steps), every quiz attempt, every Super Coin
entry, all notifications, bug reports and error log entries, and **every
account that is not an admin** (doctors, regular and bulk buyers, with their
addresses, carts, Launch drafts, brand profiles, threads and uploaded
documents). Stock that unpaid test orders were holding is given back.

**What it keeps:** admin (staff) accounts, the products and their stock
levels, quizzes, e-books, courses, the home page content, settings and the
admin log. (Courses can't be bought on the site yet, so there are no course
purchases to clear; paid e-books are orders and are cleared with them.)

**Safety locks.** It does nothing unless all of these are true:

- the database name contains `test` or `staging` (for example
  `u123456789_saatvik_test`);
- the settings are the test address's (the team password
  `STAGING_ACCESS_PASSWORD` is set), not the live site's;
- you asked for `--delete`, **and** then typed the database name exactly when
  it asked. Anything else cancels.

Without `--delete` it is a **dry run**: it only lists what it would remove
and keep, and changes nothing.

Steps:

1. hPanel > the **test** Node.js app > open the **terminal** (Advanced > SSH
   Access, or the browser Terminal button).
2. Go into the **test** app's folder, for example:
   ```
   cd /home/u123456789/domains/test.yourdomain.com/nodejs
   ```
3. First a dry run. It only counts, it changes nothing:
   ```
   pnpm db:clear-test-data --dry-run
   ```
   It prints something like this:
   ```
   Database: u123456789_saatvik_test on localhost

   Would remove:
     Accounts (not admins):  14 (6 Ayurveda Doctor, 5 Customer, 3 Pharmacy / Store)
     Orders:                 22 (4 Launch Your Brand), with 25 payment(s) and 9 invoice(s)
     Quiz attempts:          11
     ...
   Keeps:
     Admin accounts:         2 (admin@..., staff@...)
     Products:               171, with their stock levels
     ...
   Dry run: nothing was changed. Run with --delete to remove it.
   ```
   Check the first line: the name must be the **test** database. If it
   says `Stopped, nothing was changed.`, read the reason; usually you are in
   the wrong folder. Call the developer rather than changing settings.
4. Check the "Keeps" list: every admin account named there must be a real
   staff member's. If the counts look right:
   ```
   pnpm db:clear-test-data --delete
   ```
   It shows the same list, then asks you to **type the database name**. Type
   it exactly and press Enter. It ends with `Done. Removed the test data and
   N file(s) ...`. Typing anything else prints `Cancelled: nothing was
   changed.`
5. Run the dry run again. Accounts, orders and quiz attempts should now be
   `0`.
6. In the test site's Admin > Admins, remove any admin account made just for
   testing (the script keeps every admin). Set the stock in Admin > Inventory
   if the testers' paid orders used it up: stock that a **paid** test order
   took is not put back.

**Never** copy the test database to the live site, or the live database to
the test address, to "save time". The two must stay separate.

### On the live site: the script refuses to run

On launch morning the team places **one rehearsal order** on the live site
(section 6). `pnpm db:clear-test-data` **won't** clear it: on the live site
it stops at once with `Stopped, nothing was changed` (the live database has
no `test` in its name). That is on purpose, so no one can ever wipe real
customers with it. Clean up by hand instead, while Maintenance mode is still
on:

1. **Admin > Orders** > the rehearsal order > **Cancel order** (note:
   "Launch rehearsal"). It stays in the list as Cancelled, which is fine: it
   was never paid, so no stock was taken and no invoice was made.
2. **Admin > Users**: delete any account a tester made for the rehearsal.
   (Testers who sign in as admins leave nothing to delete.)

### Before the test data is gone for good

Nothing from testing needs keeping. If the team wants a record of bugs found,
export or screenshot the bug reports in Admin > Errors on the test address
**before** step 4 (the script removes them).

---

## 4. The live settings file

The same lines as the test address (`docs/TEST_DEPLOY_STEPS.md` step 6b),
with the **live** column of the table in `docs/DEPLOY.md`:

```
DATABASE_URL="mysql://LIVEDBUSER:LIVEDBPASSWORD@DBHOST:3306/LIVEDBNAME"
BETTER_AUTH_URL="https://yourdomain.com"
BETTER_AUTH_SECRET="THE NEW LIVE SECRET KEY"
STORAGE_DIR="/home/u123456789/saatvik-live-uploads"
PAYMENT_PROVIDER="manual"
SHIPPING_PROVIDER="test"
SHOW_DESIGN_PAGE="false"
DEV_SHOW_OTP="false"
APP_VERSION="live-2026-11-01"
ADMIN_EMAIL="LIVE ADMIN EMAIL"
ADMIN_PASSWORD="LIVE ADMIN PASSWORD"
ADMIN_NAME="Saatvik Vaidya Admin"
```

Differences from the test address, each one on purpose:

- **No `STAGING_ACCESS_USER` or `STAGING_ACCESS_PASSWORD` lines at all.**
  Those are the team password lock. If they are there, the live site would
  ask every customer for a password (and refuse to start, because the
  database name has no `test` in it).
- A **different** database, secret key and uploads folder.
- `BETTER_AUTH_URL` is the main address, with `https://`, and **exactly** the
  address chosen in section 2 (with or without `www`).
- The three `ADMIN_...` lines are deleted again right after the admin is
  created.

---

## 5. Launch morning: switching the main address

**When:** Sunday 1 November, **07:00 to about 11:00** (India time). Early
Sunday is the quietest time. The steps take about 2 hours; the rest is
buffer.

**Before 07:00:** owner, developer and project manager are in the group chat.
The owner has the password manager open and the Coming soon backup to hand.

### Step 1. Upload the final version (07:00)

1. On the Mac, make the ZIP of the version agreed on 29 October:
   ```
   cd "/Users/work/Data/Other/KodeAura7/Projects/SaatvikVaidya"
   git switch dev && scripts/package_for_hostinger.sh --out ~/Desktop
   ```
   It must end with `Done. Nothing was uploaded.` (details:
   `docs/TEST_DEPLOY_STEPS.md` step 4a). Check `PACKAGE_INFO.txt` inside
   shows the commit id written down on 29 October.

### Step 2. Attach the new app to the main address (07:15)

Do what you found out on 30 October. Usually:

1. If hPanel needs the old website removed first: **check the Coming soon
   backup is on your computer**, then remove it the way Hostinger support
   described. From here until step 4, visitors may see an error or blank
   page. That is expected and short.
2. hPanel > _Websites > Add website > Node.js Apps_ > **Upload your website
   files** > the ZIP > choose **`yourdomain.com`**.
3. The build settings are the same as the test address
   (`docs/TEST_DEPLOY_STEPS.md` step 5): Next.js, Node 24.x, pnpm, install
   `pnpm install --frozen-lockfile --prod=false`, build `pnpm build`, start
   `pnpm start`.
4. Put the live settings (section 4) into the app screen's **Environment
   variables** (if it has them) **before** the first build, and into the
   `.env.local` file in the app's main folder (show hidden files). Both must
   match.
5. **Deploy.** Wait for the build to finish (several minutes).

**If the DNS is outside Hostinger:** at the domain company, change the `@`
record (and `www`, if used) to the Hostinger server's IP address now. With
the TTL lowered on 30 October, most visitors reach the new app within 5 to
30 minutes.

### Step 3. Set up the database and switch Maintenance mode on (07:45)

Do these straight after each other. Between the first command and the last
step, the full (empty) site is briefly open to anyone who happens to visit.
Keep that window to a few minutes.

1. hPanel terminal, in the **live** app's folder (check the path says
   `yourdomain.com`, not `test.`):
   ```
   pnpm db:deploy
   pnpm db:seed
   pnpm db:seed:catalogue
   pnpm admin:create
   ```
   (What each does: `docs/TEST_DEPLOY_STEPS.md` step 7. Never run
   `pnpm db:reset` or `pnpm db:migrate` here.)
2. **Delete the three `ADMIN_...` lines** from `.env.local` and from the app
   screen.
3. Restart the app in hPanel.
4. Open `https://yourdomain.com`, click **Sign in**, sign in with the live
   admin.
5. **Admin > Settings > Maintenance mode: On.** Message, for example:
   "Saatvik Vaidya opens today. Please check back in a few hours." Save.
6. In a private (incognito) window, open the address: you should see the
   "We'll be back very soon" page with that message, not the shop.

From now on visitors see that page; signed-in admins see the whole site.

**If the padlock isn't there yet** (step 4 shows "Not secure"), do step 4
below first and don't type the admin password until it shows.

### Step 4. Turn on HTTPS for the main address (as soon as the app is attached)

1. hPanel > **Security > SSL**. Find `yourdomain.com` **and**
   `www.yourdomain.com`.
2. If either says **Not installed** or **Inactive**, click **Install** and
   choose the free **Lifetime SSL**. If the Coming soon page already had a
   padlock, it may simply carry over; check it still says **Active**.
3. Wait until both say **Active** (usually 15 minutes, sometimes longer; if
   the DNS just moved, it can only be issued after the move is seen).
4. Switch on **Force HTTPS** for the main domain, so `http://` goes to
   `https://`.
5. **Make the second address forward to the main one.** If the main address
   is `yourdomain.com`, set `www.yourdomain.com` to forward (301 redirect)
   to `https://yourdomain.com` in hPanel (search "Redirects"). The site only
   accepts sign-in on the exact address in `BETTER_AUTH_URL`, so without the
   forward, signing in on `www.` fails. If hPanel can't forward it, tell the
   developer.

**Good to know about HTTPS on the live site:** once open, the site tells
browsers to always use `https://` for this address for six months (the
`Strict-Transport-Security` header). That is normal and safe, but it means
the address must keep a working padlock from now on, including if the Coming
soon page is ever put back (section 7). It does not affect the test address.

### Step 5. Get the shop ready (08:15, firm admin)

Signed in as admin, while Maintenance mode is on:

1. **Admin > Settings:**
   - Payment details (QR and bank): payee name, real UPI ID, bank name,
     account number, IFSC.
   - Seller details: legal name, address, GSTIN.
   - Support phone and WhatsApp number, delivery fee, discount.
   - Any announcement bar: off, unless the firm wants an opening message.
2. **Admin > Inventory:** real stock for every product. Products without
   stock can't be bought.
3. **Admin > Users / admins:** invite the other staff admins
   (Admin > Admins > Invite). Each sets a strong password and two-factor
   sign-in.
4. **Content:** quizzes, courses, Launch Your Brand products and the home
   page look right. Create the first real quiz if one should be open on day
   one.

---

## 6. Launch-day checks and opening (09:00)

Testers sign in to the live site as admins **or** with their own new
accounts (accounts are fine; they are deleted by hand in Admin > Users after
the checks, see "Clean up the rehearsal" below). Check on **a phone (375 px wide, or any phone)** and
**a computer**.

### Checks while Maintenance mode is still on

- [ ] `https://yourdomain.com` shows the **padlock**. Clicking it says the
      certificate is for `yourdomain.com`.
- [ ] `http://yourdomain.com` switches to `https://` by itself.
- [ ] `www.yourdomain.com` forwards to `https://yourdomain.com` (or the
      other way round, as chosen).
- [ ] **No password box** appears before the site (that would mean the team
      lock lines slipped into the live settings: remove them and restart).
- [ ] `https://yourdomain.com/robots.txt` does **not** say `Disallow: /`
      (a "page not found" is fine). Otherwise search engines would skip the
      live site (`docs/ACCESS_CONTROL.md` section 4).
- [ ] No page says **"Site settings need fixing"**. If one does, the reason
      is at the top of the app's log in hPanel (`docs/DEPLOY.md`, "Start-up
      check").
- [ ] `https://yourdomain.com/design` and `https://yourdomain.com/.env.local`
      both show "page not found".
- [ ] Home page, Top Brands, a product page, Courses, Quiz & Win, Launch Your
      Brand and Dr. Talk all open, with no error on phone and computer.
- [ ] **Sign-up and sign-in** with email and password work for a new
      regular buyer, a bulk buyer and a doctor.
- [ ] **Rehearsal order:** a tester adds one product to the cart, checks out
      and sees the **QR payment screen** with the right amount, order number,
      UPI ID and bank details. **Don't pay it and don't mark it paid.**
- [ ] The firm admin sees that order in Admin > Orders as "Waiting for
      payment".
- [ ] A doctor upload (a document) works, and the file shows in Admin >
      Approvals. That proves the uploads folder works.
- [ ] Admin > Errors has nothing new and serious.

### Clean up the rehearsal (only now, only before opening)

1. Cancel the rehearsal order and delete the testers' accounts by hand, as
   in section 3, "On the live site". (`pnpm db:clear-test-data` refuses to
   run on the live site, on purpose.)
2. Check Admin > Orders shows only the cancelled rehearsal order, and Admin >
   Users shows only staff admin accounts.

### Go/no-go and open (about 10:30)

- [ ] Project manager reads out the checks above: all ticked?
- [ ] Owner and project manager say **Go**.

Then:

1. **Admin > Settings > Maintenance mode: Off.** Save.
2. In a private window, open `https://yourdomain.com`: the full site shows.
3. Add the main address to the uptime monitor.
4. Project manager tells the firm and the team the site is open.

### First hours after opening

- The firm admin watches **Admin > Orders**, marks payments as soon as the
  money is seen (stock is only held 30 minutes for an unpaid order).
- The developer looks at **Admin > Errors** and the app log every hour until
  evening.
- **Take a database backup** at the end of the day (hPanel > Backups, or the
  developer's `mysqldump`), and back up the live uploads folder. Then do this
  daily (`docs/DEPLOY.md` section 5).
- The old Coming soon backup is kept until at least 15 November.

---

## 7. Rollback: putting "Coming soon" back

Decide quickly. **Roll back if** customers can't sign up, sign in, see the QR
payment screen, or pages break on phones, and the developer can't fix it
within about 30 minutes. The owner and project manager make the call.

### Level 1: Maintenance mode (1 minute, the usual way)

Works whenever the site itself still runs and an admin can sign in.

1. Sign in as admin (on the maintenance page there is an **Admin sign-in**
   link at the bottom).
2. **Admin > Settings > Maintenance mode: On**, with a message such as
   "We're opening very soon. Thank you for your patience." Save.
3. Check in a private window: visitors see the "We'll be back very soon"
   page with the message and the support phone number. Admins still see the
   full site, so the developer can find the problem.

Orders and accounts already made stay safe in the database. Tell any
customer who ordered that their order is kept.

This page says "Maintenance" and "We'll be back very soon"; only the message
under it can be changed. It is a stand-in for the Coming soon page, not the
same page. The standalone Coming soon page (`coming-soon/`, see
`docs/COMING_SOON.md`) is the one for level 2.

### Level 2: the old Coming soon page (15 to 60 minutes)

Use this only if the site won't start at all (every page errors, and the log
shows the app crashing), so Level 1 isn't possible.

1. In hPanel, stop the live Node.js app (don't delete it, and **never**
   delete the live database).
2. Put the Coming soon page back on `yourdomain.com` the way Hostinger support
   described on 30 October:
   - plain files: recreate the website for the domain, then File Manager >
     `public_html` > **Upload** the backup ZIP > **Extract**;
   - Website Builder or WordPress: restore from hPanel > Backups;
   - or, if there is no backup to hand, upload the standalone page from the
     project's `coming-soon/` folder (`docs/COMING_SOON.md`). It needs no
     database or app.
3. Check the **padlock** still shows on `https://yourdomain.com`. Browsers
   that already visited the live site will only accept `https://` for six
   months, so the Coming soon page must have working SSL too.
4. If the DNS was moved to Hostinger on launch morning and the old page lived
   elsewhere: put the `@` and `www` records back to the values written down
   on 30 October.

### Level 3: data went wrong

If the database was damaged (rare): stop the app, and the developer restores
the latest backup in hPanel > Backups. Anything made after that backup is
lost, so take backups as listed in section 6.

### After any rollback

- The project manager tells the firm and the team, with the next try date
  (no later than **Friday 6 November**).
- The developer writes down what failed in `docs/PROGRESS.md` and fixes it
  on the **test address** first. The live app stays in Maintenance mode (or
  stopped) until the fix passes the section 6 checks there.
- Next try: upload the fixed ZIP to the live app, restart, repeat section 6.
  The database setup (section 5, step 3) is **not** repeated; only run
  `pnpm db:deploy` if the developer says the fix changed the tables.

---

## 8. Timeline at a glance

| When | What | Who |
| --- | --- | --- |
| Thu 29 Oct | Team testing done, fixes re-checked, final version agreed, owner's decisions made | Testers, developer, owner |
| Fri 30 Oct | Back up Coming soon page, ask Hostinger how to replace it, create live database and uploads folder, new secret, lower DNS TTL if needed, firm admin gathers real details | Owner, firm admin |
| Sat 31 Oct | Clear test data, go/no-go meeting | Owner, project manager |
| Sun 1 Nov 07:00 | Make ZIP, attach app to main address, deploy | Owner |
| 07:45 | Database set-up, admin, **Maintenance mode on** | Owner |
| 07:45 to 08:15 | HTTPS active, Force HTTPS, `www` forward | Owner |
| 08:15 | Real settings, stock, staff admins | Firm admin |
| 09:00 | Launch-day checks, rehearsal order, clean-up | Testers, firm admin, owner |
| about 10:30 | Go/no-go, **Maintenance mode off**, site open | Owner, project manager |
| Rest of the day | Watch orders and errors, evening backup | Firm admin, developer |
| By Fri 6 Nov | Latest date for a second try after a rollback | Everyone |
