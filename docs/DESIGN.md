# Saatvik Vaidya design system (v2)

Every screen follows this file. The visual reference is the client's UI v2 in
`docs/mockup-v2/` (October 2026): the homepage `index.html`, every inner page
in `portal.html?view=...`, and screenshots of every view at 375 and 1280 px in
`screens/`. `docs/mockup-v2/styles.css` and `portal.css` hold its exact
values. The older `docs/mockup/` is kept only for history.

Where this file and the mockup disagree, this file wins. Every difference is
deliberate and listed under [Differences from the mockup](#differences-from-the-mockup),
mostly for contrast and readability on phones.

## Principles

1. **Phone first.** Design at 375 px wide, then widen. Nothing may scroll
   sideways at 360 px, except horizontal carousels that are meant to.
2. **Warm and trustworthy.** Paper and cream surfaces, forest green for the
   brand and trust, orange for action, gold for coins, the quiz and highlights
   on dark green. The colour roles below are fixed.
3. **One primary action per view.** Only one orange primary button is visible
   in any one card or section.
4. **Readable.** Body text is never under 14 px. Small labels are never under
   11 px, even where the mockup uses 6–10 px.
5. **Bilingual-ready.** Headings use Manrope and body text DM Sans, both with
   Noto Sans Devanagari as the fallback, so Hindi renders correctly. No text
   is baked into images.
6. **Accessible.** WCAG 2.2 AA contrast, visible focus rings, 44 px minimum tap
   targets, full keyboard support, and `prefers-reduced-motion` respected.

## Tokens

Defined once as CSS variables in `src/app/globals.css`, exposed to Tailwind
through `@theme`. Components use the tokens only, never raw colour values;
`globals.css` is the only file with raw values. `/design` shows every token.

### Colour

Brand (forest green):

| Token | Value | Role |
|---|---|---|
| `brand` | `#063f36` | Brand and trust: solid dark buttons, links, active pills and chips, focus ring, done steps |
| `brand-mid` | `#0a5a49` | Eyebrow text, brand hover on light backgrounds |
| `brand-dark` | `#042f28` | Dark bands, text on `brand-soft` |
| `brand-soft` | `#e8f2ec` | Selected chips, active nav background, soft icon tiles, verified pills |
| `brand-light` | `#8fd9b6` | Brand-green text on dark backgrounds (logo on the footer) |

Orange (action):

| Token | Value | Role |
|---|---|---|
| `orange` | `#f36c21` | Accents: eyebrow line, bars, dots, progress, brand mark, `cta` glow |
| `orange-strong` | `#c2540a` | Fill behind white text (primary button, announcement), 4.6:1 |
| `orange-dark` | `#b34a08` | Hover/pressed for `orange-strong`, 5.4:1 with white |
| `orange-ink` | `#a8470a` | Orange text on white, paper, cream and `orange-soft` (4.8:1+) |
| `orange-title` | `#e25f17` | The orange second line of large headings only (24 px+ bold), 3.3:1 on cream |
| `orange-soft` | `#fff0e7` | Orange pills and icon tiles |
| `orange-light` | `#ff8a3d` | Orange text on dark green |

Gold (coins, quiz, highlights):

| Token | Value | Role |
|---|---|---|
| `gold` | `#f3ba37` | Coins, quiz, active track steps |
| `gold-soft` | `#fff2c5` | Coin pill, gold pills and tiles |
| `gold-ink` | `#5c4300` | Text on gold, the gold gradients and `gold-soft` (4.5:1+) |
| `gold-light` | `#ffc247` | Gold on dark green: heading emphasis, stat numbers, icons |

Support and neutrals:

| Token | Value | Role |
|---|---|---|
| `success` | `#0a6a4d` | Success text, "In stock", positive amounts |
| `success-soft` | `#e8f4ed` | Success pill background |
| `blue` | `#0b5f79` | Learning/courses accent only |
| `blue-soft` | `#e7f1f5` | Blue pills and tiles |
| `danger` | `#c6411b` | Errors |
| `danger-soft` | `#fff0ea` | Error backgrounds |
| `live-dot` | `#ef4d38` | The "live" dot |
| `ink` | `#14231f` | Main text |
| `muted` | `#5f6d68` | Secondary text |
| `line` | `rgb(20 35 31 / 0.12)` | Borders, dividers |
| `line-strong` | `rgb(20 35 31 / 0.22)` | Stronger borders (outline buttons, kbd hints) |
| `surface` | `#ffffff` | Cards |
| `surface-alt` | `#fafaf7` | Input fill, quiet panels |
| `paper` | `#fffdf8` | Page background, header and dock |
| `cream` | `#f8f5ed` | Warm sections (community, learning, why, inner-page body) |
| `track` | `#e5e9e6` | Empty progress and step lines |
| `backdrop` | `rgb(4 24 20 / 0.72)` | Modal and drawer backdrop (with 8 px blur) |
| `forest-ink` | `#c9ddd7` | Secondary text on dark green panels |
| `night` | `#082d27` | Footer band |
| `night-ink` | `#a9c1ba` | Text on the footer |

Text pairs that are checked for AA: white on `brand`, `orange-strong`,
`orange-dark`, and the pack gradients; `ink`, `muted` on white, paper and
cream; `orange-ink`, `success`, `blue`, `danger` on their `-soft` tints;
`gold-ink` on gold; `forest-ink` and `gold-light` (large text) on the dark
green gradients.

### Gradients and texture

Named utilities in `globals.css`, never written inline:

| Utility | Use |
|---|---|
| `bg-hero` | Home hero, dark forest green |
| `bg-page-hero` | Inner-page hero (PageHero) |
| `bg-forest` | Dark green cards and bands: Track Order, final CTA, course art, wallet |
| `bg-brand-wash` | Pale green wash behind Launch Your Brand |
| `bg-quiz` | Gold Quiz & Win panel (text in `ink`/`gold-ink`) |
| `bg-coins-band` | Gold coins strip |
| `bg-coin` | The coin itself |
| `bg-pack-green`, `bg-pack-saffron`, `bg-pack-blue`, `bg-pack-gold` | Product packs, reels and course covers (white text) |
| `bg-avatar` | Avatars and the profile mark |
| `bg-cta` | Orange fill for the primary button (AA-safe with white) |
| `bg-announcement` | The announcement bar (AA-safe with white) |
| `bg-brand-mark` | The logo mark |
| `bg-dots` | Dotted texture for dark heroes; put it on an empty, `aria-hidden`, absolutely positioned layer |

### Typography

Fonts load with `next/font` (self-hosted, no external origin) in
`src/app/layout.tsx` and are exposed as `--font-heading` and `--font-body`:

- **Manrope** for headings (`h1`–`h6` get it automatically; use
  `font-heading` on non-heading elements styled as titles, labels and big
  numbers).
- **DM Sans** for body text (the default `font-sans`/`font-body`).
- **Noto Sans Devanagari** as the fallback for both, so Hindi works.
- Hindi quotations use `Noto Serif Devanagari` (`font-serif-hindi`).

| Token | Size (phone → desktop) | Weight | Line height | Letter spacing | Use |
|---|---|---|---|---|---|
| `text-display` | 44 → 82 px (`clamp(44px, 6vw, 82px)`) | 800 | 1 | −0.045em | Home hero h1 |
| `text-h1` | 36 → 64 px (`clamp(36px, 5vw, 64px)`) | 800 | 1.02 | −0.045em | Inner-page hero h1 |
| `text-h2` | 34 → 54 px (`clamp(34px, 4.3vw, 54px)`) | 800 | 1.05 | −0.045em | Section titles |
| `text-h3` | 22 → 28 px | 800 | 1.15 | −0.035em | Panel and portal section titles |
| `text-h4` | 16 → 18 px | 800 | 1.3 | −0.02em | Card titles |
| `text-body-lg` | 16 → 18 px | 400 | 1.65 | 0 | Hero and section intros |
| `text-body` | 15 px (14 minimum) | 400 | 1.6 | 0 | Body |
| `text-small` | 13 px | 500 | 1.5 | 0 | Meta, help text |
| `text-label` | 11–12 px, UPPERCASE | 800 | 1.2 | 0.14em | Eyebrows, pills, kickers |

**Heading pattern.** Section and hero titles have two lines. The second is an
`<em>` (not italic) in **orange** on light backgrounds (`text-orange-title`)
and in **gold** on dark green (`text-gold-light`). Never teal or green. For
example: "Your Ayurveda brand, *made simple.*" or "Learn. Connect. *Build.
Grow.*"

**Eyebrow.** Above each section title: an 11–12 px uppercase Manrope label in
`brand-mid` (`brand-soft` on dark backgrounds), led by a short orange line
(28 × 2 px, rounded). Inner-page heroes use a gold eyebrow with the same
orange line.

### Spacing, radius, shadow

- Spacing uses a 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 52, 64, 78, 100.
- Page container (`shell`): `min(1180px, 100% − 40px)`; under 820 px
  `min(100% − 30px, 720px)`; under 560 px `100% − 26px`.
- Section vertical padding (`section-y`): 100 px, 78 px under 820 px and 62 px
  under 560 px. Inner pages: hero 54 px (42 under 760, 35 under 560), body
  54 px top.
- Radius tokens:
  - `sm` 8 px (small pills, tags, small buttons inside cards)
  - `md` 12 px (inputs, chips, icon tiles, avatars)
  - `button` 13 px (buttons)
  - `lg` 18 px (small cards, journey tiles, step strips)
  - `xl` 24 px (cards, feature panels)
  - `modal` 24 px (modals and bottom sheets)
  - `2xl` 28 px (hero console, product studio)
  - `3xl` 30 px (final CTA)
  - `full` (pills, coin, dots)
- Shadow tokens:
  - `card`: `0 16px 44px rgb(18 49 41 / .07)`, cards
  - `raised`: `0 24px 70px rgb(9 49 42 / .12)`, feature panels, hover
  - `modal`: `0 35px 90px rgb(0 0 0 / .3)`
  - `cta`: `0 12px 28px rgb(243 108 33 / .27)`, the orange primary button only
  - `gold`: `0 28px 70px rgb(176 119 8 / .18)`, the gold quiz panel
  - `forest`: `0 28px 70px rgb(6 63 54 / .2)`, dark green cards
  - `dock`: `0 -8px 30px rgb(18 45 37 / .08)`, the mobile dock

### Breakpoints

Mobile-first Tailwind breakpoints: `sm` 560 px, `md` 820 px, `lg` 1100 px,
`xl` 1280 px. Test at 360, 375, 414, 768, 1024 and 1280 px.

### Motion

- Transitions: 150–250 ms, `ease`.
- Hover: buttons lift −2 px, cards −3 px (Why cards −4 px with `raised`).
- Modal entry: fade plus 18 px rise and 0.98 scale, 250 ms (`animate-rise-in`).
- Drawer: slides in from the right in 300 ms; the backdrop fades.
- **Scroll reveal** (`reveal` utility): sections fade in and rise 20 px as they
  enter the viewport. It is pure CSS (a scroll-driven animation), so content
  is never hidden where the browser lacks support or JavaScript fails.
- Hero slide cross-fade (where a carousel is used) auto-advances every 6.5 s
  and pauses on hover and focus.

Everything is off under `prefers-reduced-motion`. E2e tests that run axe on a
page using `reveal` set `reducedMotion: "reduce"` first, so axe never reads a
half-faded element.

## Components

Components live in `src/components/ui/` (primitives) and
`src/components/site/` (header, footer and other site-level pieces). Every
component is typed, accepts `className`, and appears on the `/design` page with
all its variants. A pattern used on two screens is a component.

Status: **now** = in the code today; **U.2**/**U.3**/**U.4** = the chunk that
brings it to v2.

| Component | v2 spec (mockup class for reference) | Status |
|---|---|---|
| **Button** | `primary` (orange `bg-cta`, white text, `cta` glow), `dark` (solid `brand`), `secondary`/soft outline (`line-strong` border, brand text), `light` (white on dark green, brand text), `ghost-dark` (white outline on dark green), `link` (brand text with arrow). Sizes: `md` 48 px, `sm` 41 → 44 px, `lg` 56 px. Radius `button`, 13 px Manrope 800. Loading state with spinner and `aria-busy`. Full width under 560 px in a CTA group. (`.btn`, `.btn-primary`, `.btn-green`, `.soft-btn`) | U.2 |
| **IconButton** | 44 × 44 minimum, brand icon, needs an `aria-label`. | U.2 |
| **Input / Select / Textarea** | 48 px high, `surface-alt` fill, `line` border, radius 12–14, focus border `brand`. Label above in 12 px/800. Help and error text below; error has a `danger` border and `aria-describedby`. (`.field`, `.select-control`) | U.2 |
| **PhoneInput** | Fixed `+91` segment with a divider, `inputmode="numeric"`, `autocomplete="tel-national"`, 10 digits only. (`.phone-field`) | U.2 |
| **OtpInput** | 6 boxes, numeric, paste support, `autocomplete="one-time-code"`, auto-advance. | U.2 |
| **PasswordInput** | Show/hide toggle, strength hint on sign-up. | U.2 |
| **Checkbox** | Terms and marketing consent lines; checked in `brand`. | U.2 |
| **ChoiceChips** | Rounded pills; selected is solid `brand` with white text. `role="radiogroup"`. (`.filter-pills`, `.role-options`, `.moq-options`) | U.2 |
| **PillTabs** | Pill tab group, active solid `brand`. Used on Dr. Talk, Courses, Feedback, leaderboard. (`.portal-tabs`) | U.2/U.3 |
| **Card** | White, `line` border, radius `xl`, padding 24–26 (18 on phones), `card` shadow; `interactive` lifts on hover; `featured` gold (`bg-quiz`) and dark green (`bg-forest`) variants. (`.portal-card`, `.feature-panel`) | U.2 |
| **Badge / Pill** | Rounded pill, 11 px uppercase: `brand`, `success` ("In stock"), `orange`, `blue`, `gold`, `live` (red dot), `soon` ("Coming next"). (`.pill`, `.stock`) | U.2 |
| **Eyebrow** | See [Eyebrow](#typography): orange line plus `brand-mid` label; `light` on dark. (`.eyebrow`, `.portal-kicker`) | U.2 |
| **IconTile** | Rounded square (37–56 px) with a soft tint: `brand`, `orange`, `blue`, `gold`. (`.feature-icon`, `.partner-icon`) | U.2 |
| **Avatar** | Initials on `bg-avatar`, rounded 12 px square. (`.avatar`) | U.2 |
| **CoinPill** | `gold-soft` pill with the coin, balance and "MY WALLET" label; icon only on phones. (`.coin-pill`) | U.2 |
| **Modal / Dialog** | Radix, focus-trapped, closes on Esc and backdrop. `backdrop` with 8 px blur. Up to 520–560 px wide, radius `modal`, padding 30–35 (20 on phones). Bottom sheet on phones. (`.modal-card`, `.portal-dialog`) | U.2 |
| **Toast** | Dark `ink` pill with a green tick; above the dock on phones. (`.toast`) | U.2 |
| **Skeleton**, **EmptyState / ComingSoon** | Loading shapes; icon, title, one line, optional button. ComingSoon uses the v2 "Coming next" pill. | U.2 |
| **Carousel**, **HScroller** | Keyboard-accessible slides; horizontal snap lists on phones (reels, product and course cards) with an edge fade. | U.2 |
| **SectionHeading** | Eyebrow, two-tone title, optional description on the right and a "View all →" link (stacked on phones). (`.section-head`) | now (colours); U.3 (layout) |
| **PageHero** | Dark green `bg-page-hero` with `bg-dots`, gold eyebrow, `text-h1` title, description, and the "BUILT FOR PROFESSIONALS" side note card (stacks under on phones). (`.portal-hero`) | U.3 |
| **StatStrip** | 4-up band, `gold-light` numbers in Manrope, 2 × 2 on phones. (`.proof-strip`) | U.3 |
| **FilterBar** | Search field and select filters in one row, stacking on phones. (`.shop-bar`) | U.3 |
| **ProgressBar**, **StepsBar**, **Stepper** | Thin bar; numbered 1–2–3 step strip; Track Order dots-and-line (done `brand`, active `gold` with halo). (`.progress`, `.stepper`, `.track-steps`) | U.3 |
| **Drawer** | Side sheet on desktop, bottom sheet on phones, focus trapped. (`.order-drawer`) | U.3 |
| **RankList**, **MediaCard**, **InfoCard**, **QuantityStepper** | Leaderboard rows; reel/feedback cards with tag, play overlay and caption; icon tile + number + title + text + link; − qty + stepper. | U.3 |

### Site-level pieces

The shell is rebuilt to v2 in U.4; until then the current shell stays.

- **Announcement bar** (`.announcement`): `bg-announcement`, white 13 px text,
  the coins message from settings.
- **Header** (`.site-header`): sticky, `paper` at 94% with an 18 px blur and a
  `line` bottom border; 82 px bar (70 under 820, 65 under 560) with the
  client's logo image, search with a ⌘K hint (icon only under 820 px), the
  "MY WALLET" coin pill, the bag, and "My Profile / Sign in / Register" or the
  avatar. Every target stays 44 px.
- **Nav rail** (`.nav-rail`): 46 px row of pill links (12 px/700, radius 9),
  active `brand-soft`; Dr. Talk is a solid `brand` pill and Quiz & Win a solid
  orange pill (`orange-strong` for AA). Scrolls sideways on phones with an
  edge fade and marks the active page.
- **MobileDock** (`.mobile-dock`): fixed bottom bar under 560 px, `paper` with
  blur and the `dock` shadow. Today: Home, My Brand, Orders, Coins, Profile;
  v2 (U.4): Home, Dr. Talk, Launch, Orders, Profile. Labels are 11 px (not the
  mockup's 8 px), active in `brand`. It respects `safe-area-inset-bottom`, and
  the body gets bottom padding so content is not hidden behind it.
- **Footer** (`.footer`): `night` band with the logo, tagline, Community /
  Products / Support columns, the phone number, the legal row and the policy
  links; text in `night-ink`.
- **SkipLink** to `#main`.

## Differences from the mockup

Deliberate, for accessibility and readability:

1. **White on orange.** The mockup puts white text on `#f36c21` and lighter
   orange gradients (3.0:1 or less). Buttons, the announcement bar and the
   orange nav pill use `orange-strong`/`bg-cta`/`bg-announcement` (4.6:1+),
   so they read a little deeper than the mockup.
2. **Orange text.** Small orange text uses `orange-ink`; the orange heading
   line uses `orange-title` (`#e25f17`, slightly deeper than `#f36c21`, which
   is only 2.8:1 on cream).
3. **Muted text** is `#5f6d68`, not `#66746f` (4.49:1 on cream, just under AA).
4. **Gold text.** Text on gold uses `gold-ink` `#5c4300` instead of the
   mockup's `#674e13`/`#82620b` (3.8:1 on the coins band).
5. **Minimum sizes.** The mockup uses 6–10 px for many labels, meta lines and
   buttons. Labels are at least 11 px, body text at least 14 px, and every tap
   target at least 44 px, so cards and rows are a little taller.
6. **Breakpoints** stay at 560 / 820 / 1100 px; the mockup's homepage steps at
   1050 px and its inner pages at 760 and 1000 px.
7. **Scroll reveal** is CSS-only and tied to scroll position, rather than the
   mockup's JavaScript class toggle with a 650 ms transition; it looks the
   same and never hides content.
8. **Sample data** in the mockup (doctor names, posts, leaderboard rows,
   prices, order numbers, the "DA" avatar) is illustration only; screens show
   real data or an honest "Coming next" state.
9. **Database tones.** Admin-editable content stores a tone (`ORANGE`,
   `TEAL`, `BLUE`, `GOLD`, `NAVY`, `GREEN`). `TEAL` content now renders in
   the brand green; the stored value keeps its name.

## Content rules

- Use sentence case, except eyebrow labels.
- Money is formatted `₹10,000`, using the `en-IN` locale for grouping.
- Phone numbers are shown as `+91 92203 58400`.
- Where an integration isn't built yet (payments, delivery, SMS, WhatsApp), show
  a ComingSoon state with honest text, for example "Online payment is coming
  soon." Never show a button that silently does nothing.
- All user-facing strings are kept in one place per feature (for example
  `src/content/home.ts`), so Hindi can be added later.
