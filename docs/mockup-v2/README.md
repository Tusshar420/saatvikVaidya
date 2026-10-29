# Client UI v2 (October 2026)

The client's current design for the whole website, saved from
https://saatvik-vaidya-platform.brahm-ayurved.chatgpt.site/ on 2026-10-12.
It replaces `docs/mockup/` as the visual reference. Read-only: never edit it.

## Files

- `index.html`, `styles.css`, `app.js`: the homepage.
- `portal.html`, `portal.css`, `portal.js`: every inner page, chosen with
  `?view=`: `doctor-talk`, `quiz`, `launch-brand`, `top-brands`, `courses`,
  `coins`, `track-order`, `feedback`, `partner`, `why`, `profile`. The views
  are rendered by `portal.js`, which also holds the modals (sign in, quiz
  result) and the "Order List" drawer.
- `logo.png`: the client's logo (640 × 320).
- `feedback-english.jpg`, `feedback-hindi.jpg`: the two letterhead feedback
  images used on the Real Feedback page.
- `screens/`: full-page screenshots of every view, `d-<view>.jpg` at 1280 px
  and `m-<view>.jpg` at 375 px (`home` is the homepage). In the phone shots
  the fixed bottom dock appears part-way down the page; that's an artefact of
  full-page capture, the dock sits at the bottom of the screen.

To see a page live, serve this folder (for example
`npx serve docs/mockup-v2`) and open `/` or `/portal.html?view=quiz`. Fonts
load from Google Fonts.

## Key values (from `styles.css` `:root`)

| Name | Value |
|---|---|
| ink | `#14231f` |
| muted | `#66746f` |
| cream | `#fbf7ee` |
| paper (page background) | `#fffdf8` |
| green (brand) | `#063f36` |
| green-2 | `#0a5a49` |
| green-3 (soft) | `#e8f2ec` |
| orange | `#f36c21` |
| orange-2 | `#ff8a3d` |
| gold | `#f3ba37` |
| gold-soft | `#fff2c5` |
| blue | `#0b5f79` |
| line | `rgba(20,35,31,.12)` |
| shadow | `0 24px 70px rgba(9,49,42,.12)` |
| radius | `24px` |

Type: Manrope 600–800 for headings (tight negative letter spacing), DM Sans
400–700 for body text. Container `min(1180px, 100% - 40px)`.

The mockup's sample data (doctor names, posts, leaderboard, prices, order
numbers) is illustration only. Never copy it into the app as real data.
