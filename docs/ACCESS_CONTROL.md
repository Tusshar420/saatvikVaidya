# Who can see what: the main address and the test address

A guide for the owner, in plain words. Written 25 October 2026.

Until 1 November 2026 there are two addresses:

| Address | What it shows | Who can open it | Search engines (Google and others) |
| --- | --- | --- | --- |
| `yourdomain.com` (the **main address**) | Only the **Coming soon** page | Everyone | Allowed to list it |
| `test.yourdomain.com` (the **test address**) | The **full website** | Only the team, with the team password | Told not to list it |

This guide covers:

1. Keeping Coming soon on the main address.
2. Letting team members into the test address, and taking them out again.
3. Keeping the test address out of Google.
4. What changes on 1 November.

**Replace `yourdomain.com`** everywhere with your real domain. **Menu names
in hPanel** (Hostinger's control panel) change from time to time. If a menu
isn't where this guide says, type its name into the search bar at the top
of hPanel.

Related guides:

- Setting up the test address: `docs/TEST_DEPLOY_STEPS.md`.
- The Coming soon page itself: `docs/COMING_SOON.md`.
- Launch day: `docs/LAUNCH_1_NOVEMBER.md`.

---

## 1. Keep Coming soon on the main address

The full website is a **Node.js app**: a program that runs on the server. It
only appears at the address you attach it to. Until 1 November, attach it
**only** to `test.yourdomain.com`. The main address keeps the plain Coming
soon page in its `public_html` folder.

### Do

- When you create the Node.js app (`docs/TEST_DEPLOY_STEPS.md` step 5),
  choose **`test.yourdomain.com`** as its address. Read it twice before you
  click Deploy.
- Upload a new version of the site (a new ZIP) **only** into the test
  address's Node.js app (**Redeploy**, or upload the files again).

### Don't

- **Don't** create a Node.js app for `yourdomain.com` or `www.yourdomain.com`
  before 1 November. Doing so can replace the Coming soon page straight
  away.
- **Don't** upload the website ZIP into the main address's `public_html`
  with File Manager. It would not run there. Worse, anyone could download the
  site's code files.
- **Don't** add the team password to the main address. Coming soon is meant
  to be public.

### Check it (takes 2 minutes; do it after every change in hPanel)

Use a private (incognito) window, on a computer and on a phone:

- [ ] `https://yourdomain.com` shows the **Coming soon** page with the
      padlock, and **no** password box.
- [ ] `https://www.yourdomain.com` shows the same page, or forwards to it.
- [ ] `https://yourdomain.com/products` does **not** show the shop. You see
      a "not found" page or the Coming soon page.
- [ ] In hPanel, open **Websites**. Only `test.yourdomain.com` is listed as a
      Node.js app.

**If the main address shows the shop:** put the Coming soon page back
straight away (`docs/COMING_SOON.md`, "Put it on the main address"). Then
check which address the Node.js app is attached to. Tell the developer.

---

## 2. Only the team can open the test address

> **2026-10-30: the password box is gone.** The owner asked to remove it, so
> the test address now opens for anyone who has the link. Keep the
> `STAGING_ACCESS_PASSWORD` line in the test address's settings anyway: it
> still keeps search engines away and tells the start-up check this is the
> test address (without it the site refuses to start). The steps below about
> adding, removing or checking the team password no longer apply. To bring
> the box back, restore `src/lib/site-gate.ts` and the check in
> `src/proxy.ts` from git history.

### How the lock works

The site has its own lock, built in and tested. When the test address's
settings file has a team password, **every page** asks for a user name and
password before anything appears. This works on phones and computers, from
any network.

The lock uses two lines in the settings file `.env.local` (the hidden file
in the app's main folder; see `docs/TEST_DEPLOY_STEPS.md` step 6):

```
STAGING_ACCESS_USER="team"
STAGING_ACCESS_PASSWORD="the team password"
```

- Everyone on the team uses the **same** name and password.
- The lock fails safe. If the password line is deleted by mistake, the site
  refuses to start: a database with `test` in its name and no team password
  counts as a mistake. It does **not** quietly open to the public.
- It is only safe with the padlock (HTTPS), so the password can't be read on
  the way. Never type it on a page that says "Not secure".

**This is the lock to use.** The other two hPanel tools (a folder password
and an IP list) are explained below, with the reasons to avoid them or only
add them as extras.

### Add a team member

1. Send them, **in a private message** (not a group chat, not email):
   - the address `https://test.yourdomain.com`,
   - the user name (`team`),
   - the password.
2. Note their name in your password manager, next to the team password, so
   you always know who has it.
3. Testers then **sign up on the site** like a customer (doctor, regular
   buyer or bulk buyer). That account is separate from the team password.
4. If they should run the shop, make them an admin in **Admin > Admins**.

Nothing on the server changes when you add someone.

### Remove a team member

There is only one shared password, so taking someone out means **changing
the password** and sending the new one to everyone who stays.

1. **Make a new password** (at least 16 characters, letters and numbers
   only). On the Mac, open Terminal, paste this and press Enter:

   ```
   openssl rand -hex 12
   ```

   It prints a random line of 24 letters and numbers, for example
   `9f2c4e7a1b3d5f60a8c2e4b6`. It only prints a value; it changes nothing.
   Save it in your password manager.
2. In hPanel, open **Files > File Manager**. Go to the test app's main
   folder (the one with `package.json`), turn on **Show hidden files** and
   open `.env.local`.
3. Replace the value on the `STAGING_ACCESS_PASSWORD="..."` line with the new
   password. Keep the quote marks. **Save.**
4. If the Node.js app screen in hPanel has an **Environment variables**
   section with `STAGING_ACCESS_PASSWORD`, change it there too. The two must
   match. If they differ, the site uses the one on the app screen.
5. On the Node.js app screen, click **Restart**.
6. Check in a private window: the **old** password is refused and the
   **new** one works.
7. Send the new password privately to everyone who stays. Their browsers
   will ask for it again the next time they open the site.
8. In the site itself, remove their account:
   - **Admin > Admins** if they were an admin;
   - **Admin > Users** to delete their test account, if it is no longer
     needed.

**Change the password the same way** if it was ever sent somewhere it
shouldn't have been, for example a group chat or email.

### hPanel's "Password Protect Directories": don't turn it on

hPanel has a folder-password tool (**Advanced > Password Protect
Directories**). Don't use it on the test address.

- A browser can send only **one** name and password. Two locks with
  different passwords would turn everyone away, the team included.
- It works through a web-server file (`.htaccess`) that a Node.js app may
  ignore, so it may not protect the site at all.

The site's own lock already does this job.

### An IP list: only as an extra, only for fixed connections

An **IP address** is the number that identifies an internet connection, for
example `203.0.113.5`. hPanel's **Advanced > IP Manager** can **allow**
listed addresses only (everyone else is blocked) or **block** listed
addresses.

**Usually it isn't practical for testing:**

- Phones on mobile data and most home connections **change address** often.
  Testers would be locked out at random.
- Like the folder password, it works through `.htaccess`. It may **not
  cover a Node.js app**.

**If the whole team works from one office** with a fixed address (ask the
internet provider), you can add it **on top of** the team password, never
instead of it:

1. Find the office address: on an office computer, open a search engine and
   search for "what is my IP". Write the number down.
2. hPanel > the **test** website > **Advanced > IP Manager** >
   **Allow an IP**. Enter the number and a note (for example "Office").
   Save.
3. **Test it before relying on it.** On a phone using **mobile data**
   (Wi-Fi off), open `https://test.yourdomain.com`:
   - **Blocked** (an error page, no password box): the list works.
   - **The password box still appears:** the list does not cover the
     Node.js app. Delete the rule. The team password still protects the
     site.
4. **To take an address off the list:** IP Manager, find the rule, click
   **Delete**.

On a VPS (a "KVM" plan) the developer can set up a proper firewall list
instead. Ask them; don't change the firewall yourself.

**Never** put an IP list on the main address before 1 November. It would
hide the Coming soon page from customers.

---

## 3. Keep the test address out of Google

### Already done for you

You don't need to change anything. The team password switches all of this
on by itself:

- **Every answer** from the test address carries a "don't list this page"
  label, called `noindex`. Search engines obey it.
- **`https://test.yourdomain.com/robots.txt`** is a small file that search
  engines read first. On the test address it says "don't look at anything":

  ```
  User-agent: *
  Disallow: /
  ```

  It is the **only** address on the test site that opens without the
  password. It contains just those two lines and nothing about the site.
- Anything else asks for the password, so a search engine can't read the
  pages anyway.

### Why the main site isn't affected

There is **one** upload ZIP for both addresses. "Test or live" is decided by
the settings file, not by the files in the ZIP:

- **Test address:** has the team password, so it gets `noindex` and the
  "don't look" `robots.txt`.
- **Main address** (from 1 November): has **no** team password, so it gets
  neither. Google can list the shop.

You can't hide the live site by uploading the wrong ZIP, because there is
only one. As a second guard, the packaging script
(`scripts/package_for_hostinger.sh`) stops with
`STOPPED: the package is not safe to upload` if it finds a "don't index
anything" setting in the code. One like that would hide the main site from
search engines after launch.

### Check it

- [ ] In a private window, open `https://test.yourdomain.com/robots.txt`. It
      shows the two lines above, **without** asking for the password.
- [ ] `https://test.yourdomain.com/` still asks for the password.
- [ ] After a few days, search Google for `site:test.yourdomain.com`.
      Nothing should be listed.

### If the test address shows up in Google anyway

This is rare. It usually means the address was open without the password
for a while.

1. Check the password box appears (section 2). Fix that first.
2. Leave `noindex` and `robots.txt` as they are. Google drops the pages on
   its next visits, usually within a few weeks.
3. To hurry it up, use **Google Search Console** (free, at
   `search.google.com/search-console`). Add the domain and confirm you own
   it (Search Console shows the steps; usually one DNS record in hPanel).
   Then open **Removals > New request** and enter
   `https://test.yourdomain.com/`. Ask the developer if you're unsure.

---

## 4. On 1 November

`docs/LAUNCH_1_NOVEMBER.md` has the full plan. For access, these are the
points that matter:

- The main address gets **its own** Node.js app, with its **own** settings
  file. That file **has no `STAGING_ACCESS_USER` or
  `STAGING_ACCESS_PASSWORD` lines**, so there is no password box and Google
  can list the site.
- The test address **keeps** its team password and its `noindex`. It stays
  private for later testing.
- Keep the `coming-soon` folder and its backup. They are the quick way to put
  Coming soon back if needed (rollback level 2).

Checks on the main address after the switch:

- [ ] `https://yourdomain.com` shows the full site, with the padlock and
      **no** password box.
- [ ] `https://yourdomain.com/robots.txt` does **not** say `Disallow: /`.
      (A "not found" page is fine.)
- [ ] `https://test.yourdomain.com` still asks for the team password.

---

## Quick reference

| I want to... | Do this |
| --- | --- |
| Check the main address still shows Coming soon | Section 1, "Check it" |
| Let a new tester in | Send the address, user name and password privately (section 2) |
| Take a tester out | Change `STAGING_ACCESS_PASSWORD`, restart the app, send the new password to the rest (section 2) |
| Lock the test address to the office | Optional. IP Manager **Allow an IP**, then test it on mobile data (section 2) |
| Keep the test address out of Google | Nothing to do; check `robots.txt` (section 3) |
| Open the main site on 1 November | `docs/LAUNCH_1_NOVEMBER.md`; no team password on the main address (section 4) |

## If something goes wrong

| What you see | What it means and what to do |
| --- | --- |
| The main address shows the shop before 1 November | The Node.js app is attached to the main address. Put Coming soon back (`docs/COMING_SOON.md`) and tell the developer. |
| The test address opens **without** a password box | **Stop sharing the address.** `STAGING_ACCESS_PASSWORD` is empty or the app wasn't restarted. Fill it in, restart and check again. |
| Every page on the test address says "Site settings need fixing" | Often the password line was removed or misspelled. The site refuses to start without it, on purpose. Fix the line and restart. |
| Nobody on the team can get in, even with the right password | Two locks are on: the folder password tool or an IP list on top of the team password. Remove the extra lock in hPanel. Also check the password in `.env.local` and on the app screen are the same. |
| A tester is blocked but others are fine | If you use an IP list, their address changed or isn't listed. Otherwise they are typing an old password. |
| `test.yourdomain.com/robots.txt` asks for the password | The site on the server is an older version. Upload a new ZIP from the `dev` version (`docs/TEST_DEPLOY_STEPS.md` step 4a). The pages are still hidden from Google by the password and `noindex`. |
| The packaging script says a "don't index" setting would hide the main site | Don't upload. Send the message to the developer. |
