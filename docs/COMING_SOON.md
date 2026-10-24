# The Coming soon page

A standalone "Coming soon" page for the main address (`yourdomain.com`) until
1 November 2026. It lives in the `coming-soon/` folder and is **not** part of
the full website:

- Plain HTML and CSS. No database, no Node.js app, no scripts.
- Nothing loads from other websites: the logo, icon and the site's two fonts
  are in the folder.
- It shows the Saatvik Vaidya logo and name, the launch date (1 November 2026)
  and a "Call +91 92203 58400" button.
- It uses the full site's colours, fonts and button style, and works on phones
  and computers.

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | Its look (values copied from `src/app/globals.css`) |
| `logo.png`, `favicon.ico` | The logo and browser-tab icon (copies of the site's) |
| `fonts/` | Manrope (headings) and DM Sans (text), English letters only |

It is left out of the upload ZIP that `scripts/package_for_hostinger.sh` makes.

## Look at it on this computer

Double-click `coming-soon/index.html`. It opens in the browser.

## Put it on the main address (Hostinger)

Only do this if the owner decides to replace the current Coming soon page.
**Back up the current page first** (`docs/LAUNCH_1_NOVEMBER.md`, Friday
30 October).

1. In Finder, open the `coming-soon` folder, select everything **inside** it
   (`index.html`, `styles.css`, `logo.png`, `favicon.ico`, `fonts`), then
   right-click > **Compress**. This makes `Archive.zip`.
2. hPanel > **Websites** > the main domain > **File Manager** > open
   `public_html`.
3. Move the old page's files out of the way (or delete them once the backup is
   safe), then **Upload** `Archive.zip` and **Extract** it into `public_html`.
   `index.html` must sit directly in `public_html`, not in a sub-folder.
4. Open `https://yourdomain.com` on a phone and a computer. Check the padlock,
   the logo, the date, and that the call button starts a call on the phone.

## Changing the text or phone number

Edit `coming-soon/index.html` (the phone number is in the `tel:` link and the
button text). Then run `pnpm exec playwright test tests/e2e/coming-soon.spec.ts`
and upload the changed file again.

## On 1 November

The full website replaces this page (`docs/LAUNCH_1_NOVEMBER.md`). Keep the
`coming-soon` folder: it is also the quick way to put "Coming soon" back if a
rollback is needed (section 7, level 2).
