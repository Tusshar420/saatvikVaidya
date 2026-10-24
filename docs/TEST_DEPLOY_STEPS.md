# Putting the site on a private test address (Hostinger)

A step-by-step guide for the owner. It puts the website on Hostinger at a
private address such as `test.yourdomain.com`, which only the team can open.
Written 25 October 2026.

- **You do these steps yourself in hPanel** (Hostinger's control panel).
  Nobody connects to the server for you.
- **Replace `yourdomain.com`** everywhere with your real domain.
- **Time needed:** about 1 to 2 hours, plus waiting for the padlock (HTTPS),
  which can take from 15 minutes to a few hours.
- **Menu names in hPanel change from time to time.** If a menu here is not
  where this guide says, type its name into the search bar at the top of
  hPanel.
- The developer's version of these steps, with more detail, is
  `docs/DEPLOY.md`. What the site is made of, and the risks on Hostinger, are
  in `docs/SITE_OVERVIEW.md`.

**When you are done:** `https://test.yourdomain.com` shows the padlock, asks
for a team name and password before showing anything, and uses its own
database, separate from the main site.

---

## Before you start

### Keep a notes sheet

You will collect about ten values (database name, passwords and so on).
Keep them in a password manager or a private note. **Never** put them in
email, WhatsApp groups or the project files.

| Value | Where it comes from | Yours |
| --- | --- | --- |
| Your hosting account number (looks like `u123456789`) | hPanel, step 3 or the File Manager path | |
| Database name | Step 3 | |
| Database user | Step 3 | |
| Database password | Step 3 | |
| Database host (often `localhost`) | Step 3 | |
| Uploads folder path | Step 4 | |
| Secret key | Step 4 | |
| Team user name and password | Step 4 | |
| First admin email and password | Step 4 | |

### Step 0. Check your Hostinger plan can run the site (do this first)

The site is a **Node.js app** (a website that runs a program on the server,
not just plain pages). Not every Hostinger plan can run one.

1. Log in to hPanel.
2. Look for **Websites > Add website > Node.js Apps** (it may be called
   "Node.js Web App").
3. Start the form but **do not finish it yet**. Look at the list of
   **Node.js versions**. You need **24** (written `24.x`) or newer.

**Stop and tell the developer if:**

- there is no Node.js option at all (basic shared plans don't have one; you
  need Business, Cloud or a VPS), or
- the newest version offered is lower than 24.

**If your plan is a VPS** (a "KVM" plan, the one recommended in the
Production Services Plan): hPanel does not set up databases, subdomains and
apps for you on a VPS in the same way. Hand steps 1 to 7 to the developer.
The checklist at the end still applies, and you can use it to check their
work.

**Why this comes first:** the launch is on 1 November. If the plan can't run
the site, changing plans takes days. Better to find out today.

---

## Step 1. Create the test subdomain

A subdomain is a second address under your domain, like
`test.yourdomain.com`.

1. In hPanel, open **Domains**, choose your domain, then **Subdomains**.
   (On some accounts: **Websites > your site > Dashboard > Domains >
   Subdomains**.)
2. Type `test` in the box and click **Create**.
3. Check that `test.yourdomain.com` appears in the list.

**Good to know:**

- If the Node.js app form (step 5) offers to create the subdomain for you,
  that is fine too. Just don't create it twice.
- **If your domain is managed somewhere other than Hostinger** (for example
  GoDaddy), the new address won't work until you add a record there. In
  hPanel, find the server's IP address (a number like `123.45.67.89`). Then,
  in your domain company's DNS settings, add an **A record**: name `test`,
  value that IP address. It can take up to a few hours to start working.

---

## Step 2. Turn on free HTTPS (the padlock)

HTTPS encrypts everything between the browser and the site. **The team
password is sent in plain text without it**, so do this before anyone opens
the address.

1. In hPanel, open **Security > SSL** (or **Websites > your site > Dashboard
   > Security > SSL**).
2. Find `test.yourdomain.com` in the list.
3. If it says **Not installed** or **Inactive**, click **Install** (or
   **Setup**) and choose the free **Lifetime SSL**.
4. Wait until the status says **Active**. Usually 15 minutes, sometimes a
   few hours.
5. Turn on **Force HTTPS** for `test.yourdomain.com`. This sends anyone who
   types `http://` to the safe `https://` version automatically. The switch
   is usually on the same SSL page or on the website's **Dashboard**.

You can carry on with steps 3 to 5 while you wait. Don't share the address
until the padlock shows.

---

## Step 3. Create a separate test database

The database is where accounts, orders and settings are stored. The test
address gets **its own** database, so test orders and test accounts never
mix with the real site's.

1. In hPanel, open **Websites > your site > Dashboard > Databases >
   Management** (or search for "MySQL Databases").
2. Fill in the form:
   - **Database name:** `saatvik_test`
   - **Database user:** `saatvik_test`
   - **Password:** a long password, at least 20 characters, **using only
     letters and numbers**. If hPanel insists on a symbol, use only `-` or
     `_`. (Other symbols like `@ # % /` break the connection line in step 4.)
3. Click **Create**.
4. hPanel adds your account number in front, so the real names look like
   `u123456789_saatvik_test`. **Write down the full names exactly as hPanel
   shows them**, plus the password.
5. Note the **host** shown on the page. On Hostinger it is usually
   `localhost`.

**Important rules:**

- The name **must contain `test`**. The site checks this when it starts. If
  the test address points at a database without `test` in its name, the site
  refuses to open. This protects the real site's data.
- **Never** point the test address at the main site's database, and never
  reuse this test database for the real site later.

---

## Step 4. Prepare the files and values on your Mac

### 4a. Make the upload file (a ZIP)

The site's code is on your Mac. You will upload one ZIP file of about 5 MB.

1. Open the **Terminal** app on the Mac.
2. Copy and paste these two lines, then press Enter:

   ```
   cd "/Users/work/Data/Other/KodeAura7/Projects/SaatvikVaidya"
   git archive --format=zip -o ~/Desktop/saatvik-test.zip dev -- . ':(exclude)docs' ':(exclude).claude'
   ```

3. A file called `saatvik-test.zip` appears on your Desktop.

What the second line does, in plain words:

- `git archive ... dev`: packs the **latest saved version** of the site (the
  `dev` version). Unsaved edits are not included.
- `-o ~/Desktop/saatvik-test.zip`: saves the ZIP on your Desktop.
- `':(exclude)docs' ':(exclude).claude'`: leaves out the planning documents
  and the assistant's settings. The site doesn't need them.
- Your secret settings (`.env.local`), your local test uploads and the
  1 GB of downloaded packages are **left out automatically**. The server
  downloads its own packages.

It only reads the project and writes the one ZIP file. Nothing else
changes.

**Why a ZIP and not "Import from GitHub":** the copy on GitHub is out of
date. Its `dev` version was last updated on 30 September, 122 changes behind
this Mac, and `main` is even older. Importing from GitHub would put an old
version of the site online. Use GitHub only if the developer has brought it
up to date first.

**Do not remove the `tests` folder from the ZIP.** The site's build checks
some files that use it, and the build fails without it. (`docs/SITE_OVERVIEW.md`
says to leave `tests/` out; that is wrong, please ignore it.)

### 4b. Make the secret key

The site uses a secret key to protect sign-ins. Make a new one for the test
address. **Never reuse it on the main site.**

In Terminal, paste this and press Enter:

```
openssl rand -base64 32
```

It prints a random line like `q3V0bm9...Zz0=`. Copy it into your notes sheet
as the **secret key**. This command only prints a random value; it changes
nothing.

### 4c. Choose the team password

This is the name and password every tester types before they see anything.

- **User name:** `team` (or anything you like, without a `:`).
- **Password:** at least 16 characters, letters and numbers only.

### 4d. Choose the first admin login

The first admin account is created by a command in step 7. Pick:

- the admin's **email**, and
- a **password** of at least 12 characters that is not a common one.

---

## Step 5. Create the Node.js app and upload the files

1. In hPanel, open **Websites > Add website > Node.js Apps**.
2. Choose **Upload your website files** (not "Import Git repository") and
   upload `saatvik-test.zip` from your Desktop.
3. When asked for the address, choose **`test.yourdomain.com`**.
4. Build settings (Hostinger may fill some in by itself; check each one):

   | Setting | Value |
   | --- | --- |
   | Framework | Next.js |
   | Node.js version | 24.x (the newest that is at least 24) |
   | Package manager (if asked) | pnpm |
   | Root / app folder | `./` (the top of the upload) |
   | Install command | `pnpm install --frozen-lockfile --prod=false` |
   | Build command | `pnpm build` |
   | Start command | `pnpm start` |

   - The install command downloads the packages the site needs, including
     the tools the build uses. Don't shorten it.
   - If Hostinger only offers `npm` and not `pnpm`, stop and tell the
     developer.

5. **If the form has an "Environment variables" section**, fill it in now
   with the values from step 6 (one name and value per row), **before** the
   first build. The build reads some of them.
6. Click **Deploy**. If the first build fails because settings were missing,
   finish step 6 and then click **Redeploy** (or **Rebuild**).

---

## Step 6. Fill in the settings file

The settings tell the site which address it is on, which database to use,
where to keep uploads and what the team password is. They live in a hidden
file called **`.env.local`** in the app's main folder (the folder that holds
`package.json`). The site and the database commands in step 7 both read it.

### 6a. Make the uploads folder

Doctors' documents, brand logos, label proofs and invoices are saved on the
server's disk. Keep them **outside** the website folder, so a new upload
can't wipe them and nobody can open them directly.

1. In hPanel, open **Files > File Manager**.
2. Go to the **top folder** of your account (the path looks like
   `/home/u123456789`). Not inside `public_html` or `domains`.
3. Create a folder called `saatvik-test-uploads`.
4. Write down the full path, for example
   `/home/u123456789/saatvik-test-uploads`.

### 6b. Create the settings file

1. In File Manager, open the app's main folder (the one with `package.json`
   in it).
2. Turn on **Show hidden files** (files whose names start with a dot are
   hidden by default).
3. Create a new file named exactly `.env.local`.
4. Paste in the lines below, then change the parts in CAPITALS using your
   notes sheet. Keep the quote marks.

```
DATABASE_URL="mysql://DBUSER:DBPASSWORD@DBHOST:3306/DBNAME"
BETTER_AUTH_URL="https://test.yourdomain.com"
BETTER_AUTH_SECRET="SECRET KEY FROM STEP 4B"
STORAGE_DIR="/home/u123456789/saatvik-test-uploads"
PAYMENT_PROVIDER="manual"
SHIPPING_PROVIDER="test"
STAGING_ACCESS_USER="team"
STAGING_ACCESS_PASSWORD="TEAM PASSWORD FROM STEP 4C"
SHOW_DESIGN_PAGE="false"
DEV_SHOW_OTP="false"
APP_VERSION="test-2026-10-25"
ADMIN_EMAIL="ADMIN EMAIL FROM STEP 4D"
ADMIN_PASSWORD="ADMIN PASSWORD FROM STEP 4D"
ADMIN_NAME="Saatvik Vaidya Admin"
```

5. Save the file.
6. **If the app screen has an "Environment variables" section** (step 5),
   make sure it holds exactly the same values. If the two places disagree,
   the site uses the one in the app screen.

What each line means:

| Line | What it does |
| --- | --- |
| `DATABASE_URL` | The test database from step 3. Example: `mysql://u123456789_saatvik_test:Abc123xyz@localhost:3306/u123456789_saatvik_test` (user, then password, then host, then database name). |
| `BETTER_AUTH_URL` | The test address, starting with `https://`. The site refuses to start with `http://`. |
| `BETTER_AUTH_SECRET` | The secret key. Different from the one the main site will have. |
| `STORAGE_DIR` | The uploads folder from 6a. |
| `PAYMENT_PROVIDER="manual"` | Customers pay by UPI QR code or bank transfer, and an admin marks the order paid. No payment gateway is connected. |
| `SHIPPING_PROVIDER="test"` | No courier is connected yet, so "Create shipment" stays switched off on the server. |
| `STAGING_ACCESS_USER` and `STAGING_ACCESS_PASSWORD` | **The lock on the test address.** With a password here, every page asks for the team name and password, and search engines are told not to list the site. |
| `SHOW_DESIGN_PAGE`, `DEV_SHOW_OTP` | Developer-only pages. Must stay `"false"`. |
| `APP_VERSION` | A label shown next to errors in Admin > Errors. Any text. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Only used once, to create the first admin in step 7. **Delete these three lines afterwards.** |

**Keep this file private.** Don't email it or share it. If you upload a new
ZIP later, check that `.env.local` is still there afterwards. A new upload
can replace the folder, so keep a copy of the values in your password
manager.

---

## Step 7. Set up the database, create the admin and start

These commands are typed into the server's **terminal** (a text window that
runs commands on the server).

1. In hPanel, open **Advanced > SSH Access** and switch SSH on. If hPanel has
   a **Terminal** button (in the browser), you can use that instead.
2. Go into the app's main folder. The path is shown in File Manager, for
   example:

   ```
   cd /home/u123456789/domains/test.yourdomain.com/nodejs
   ```

   (Use your real path. `cd` means "go into this folder".)
3. Run these commands one at a time, waiting for each to finish:

   ```
   pnpm db:deploy
   pnpm db:seed
   pnpm db:seed:catalogue
   pnpm admin:create
   ```

   | Command | What it does |
   | --- | --- |
   | `pnpm db:deploy` | Creates the empty tables in the test database. Safe to run again; it never deletes data. |
   | `pnpm db:seed` | Adds the starting content: categories, pages, settings and a sample catalogue. |
   | `pnpm db:seed:catalogue` | Loads your real product list (159 products). Optional. |
   | `pnpm admin:create` | Creates the first admin from the `ADMIN_...` lines. |

4. **Now delete the three `ADMIN_...` lines** from `.env.local` (and from the
   app screen's Environment variables, if you used it).
5. In the Node.js app screen in hPanel, click **Restart** (or **Redeploy**).

**Never run** `pnpm db:reset` or `pnpm db:migrate` on the server. They are
for the developer's computer and can wipe the database.

**If a command says `pnpm: command not found`** or fails with an error you
don't understand, copy the message and send it to the developer. Don't try
other commands.

---

## Step 8. Make sure only the team can open it

### The lock to use: the site's own team password

Once `STAGING_ACCESS_PASSWORD` is set (step 6), **every page** asks for the
team name and password before showing anything. It is already switched on.
It is the recommended lock because:

- it works on any plan, on phones and on computers, from any network;
- it was built and tested for this site;
- it fails safe: if the password line goes missing, the site refuses to
  start rather than opening to everyone. (A database with `test` in its name
  and no team password is treated as a mistake.)

**Sharing it:** send the name and password to each tester in a private
message. If someone leaves the team, change `STAGING_ACCESS_PASSWORD` in the
settings file (and the app screen, if used), restart the app, and send the
new one to the others.

### hPanel's "Password Protect Directories": don't turn it on

hPanel has its own password tool for folders. **Don't add it on top of the
team password.** A browser can only send one name and password, so two
different locks would turn everyone away, including the team. It may also not
cover Node.js apps at all. The site's own lock already does this job.

### An IP allow list: usually not practical

An IP allow list lets in only certain internet addresses, for example your
office.

- It only works if every tester has a **fixed** internet address. Phones on
  mobile data and most home connections change address often, so testers
  would be locked out at random.
- On shared and Cloud plans, hPanel's **IP Manager** mainly **blocks**
  addresses. It is not built to "allow only these".
- On a VPS, the developer can set a firewall allow list if the team works
  from one fixed office connection. This can be added **on top of** the team
  password, never instead of it.

**Recommendation:** use the team password alone for testing.

---

## Step 9. Final checklist

Tick each line. If any fails, see "If something goes wrong" below. Don't share
the address with the team until every line is ticked.

### The padlock (HTTPS)

- [ ] Open `https://test.yourdomain.com`. A **padlock** shows next to the
      address, with no "Not secure" warning.
- [ ] Click the padlock: it says the connection is secure and the
      certificate is for `test.yourdomain.com`.
- [ ] Type `http://test.yourdomain.com` (without the "s"). The browser
      switches to `https://` by itself.
- [ ] On your phone, the same address also shows the padlock.

### An outsider cannot open it

Use a **private (incognito) window**, so the browser hasn't remembered the
password.

- [ ] The address shows a **sign-in box** asking for a user name and
      password **before** any part of the site appears.
- [ ] Click **Cancel**. You see only "Private test site. Sign in with the
      team password." and nothing else from the site.
- [ ] Try a **wrong password**. You are refused and asked again.
- [ ] Try `https://test.yourdomain.com/products` and
      `https://test.yourdomain.com/admin` in a fresh private window. Both
      ask for the password first.
- [ ] **On a phone using mobile data** (Wi-Fi off), open the address. The
      sign-in box appears. This proves it is locked from outside your
      network too.
- [ ] Ask one person **outside the team** to open the address. They see only
      the sign-in box.

### The team can open it and it works

- [ ] With the right team name and password, the home page loads.
- [ ] No page says **"Site settings need fixing"** (see below if it does).
- [ ] Sign in with the first admin from step 4d. **Admin > Orders** opens.
- [ ] `https://test.yourdomain.com/design` shows a "page not found" page.
- [ ] `https://test.yourdomain.com/.env.local` shows "page not found". It
      must **never** show the settings file.
- [ ] In **Admin > Settings > Payment details (QR and bank)**, fill in the
      UPI ID and bank details, then place one test order. The QR code
      screen appears with the right amount.

### After a few days

- [ ] Search Google for `site:test.yourdomain.com`. Nothing should be listed.

When all are ticked, share the address and team password with the testers,
and give them the testing checklist in `docs/DEPLOY.md` section 3.

---

## If something goes wrong

| What you see | What it means and what to do |
| --- | --- |
| Every page says **"Site settings need fixing"** | The site checked its settings and found a problem. The reason is at the top of the app's log in hPanel. Usually: `BETTER_AUTH_URL` doesn't start with `https://`, or the database name has no `test` in it, or the team password is missing. Fix the line in step 6 and restart the app. |
| **No sign-in box appears** and the site opens straight away | **Stop sharing the address.** `STAGING_ACCESS_PASSWORD` is empty or the app wasn't restarted. Fill it in, restart, and repeat the step 9 checks. |
| The browser says **"Not secure"** or shows a certificate warning | The free SSL isn't ready. Wait an hour; if it is still not working, reinstall it in step 2. Don't type the team password on a "Not secure" page. |
| The install fails with "Unsupported engine" or a Node version message | The app isn't on Node 24. Choose 24.x in the app settings. If it isn't offered, tell the developer. |
| The build stops with "killed", "out of memory" or a time limit | The plan may be too small to build the site. Tell the developer. (Risk 2 in `docs/SITE_OVERVIEW.md`.) |
| `pnpm: command not found` | The server doesn't have the install tool the site uses. Tell the developer. |
| A tester didn't get a sign-up or "forgot password" email | Expected. Emails aren't sent yet; they only go to the server log. Testers sign up with email and password, and an admin helps anyone locked out. Phone-code (OTP) sign-in doesn't work yet either. See `docs/DEPLOY.md` section 4. |
| Uploaded files vanished after a new upload | The uploads folder was inside the app folder. Move it outside, as in step 6a. |

---

## What comes next (not part of this guide)

- Team testing: `docs/DEPLOY.md` section 3.
- Security checks for the developer (headers, rate limits, backups):
  `docs/DEPLOY.md` section 5.
- Clearing test accounts and orders before launch, and switching the main
  address on 1 November: `docs/DEPLOY.md` sections 6 and 7.
