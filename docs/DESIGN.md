# Saatvik Vaidya design system

Every screen follows this file. The client mockup in `docs/mockup/` (open
`docs/mockup/index.html` in a browser) is the visual reference, and
`docs/mockup/styles.css` holds its exact values. Where this file and the mockup
disagree, this file wins. The differences are deliberate, mostly for
readability on phones.

## Principles

1. **Phone first.** Design at 375 px wide, then widen. Nothing may scroll
   sideways at 360 px, except horizontal carousels that are meant to.
2. **Warm and trustworthy.** White and cream surfaces, teal for trust, orange for
   action, gold only for coins. The colour roles below are fixed.
3. **One primary action per view.** Only one orange primary button is visible
   in any one card or section.
4. **Readable.** Body text is never under 14 px. Small labels are never under
   11 px, even where the mockup uses 8–10 px.
5. **Bilingual-ready.** Text uses Inter with Noto Sans Devanagari as a fallback,
   so Hindi renders correctly. No text is baked into images.
6. **Accessible.** WCAG 2.2 AA contrast, visible focus rings, 44 px minimum tap
   targets, full keyboard support, and `prefers-reduced-motion` respected.

## Tokens

Define these once as CSS variables in `src/app/globals.css`, exposed to Tailwind
through `@theme`. Components use the tokens only, never raw hex values.

### Colour

| Token | Value | Role |
|---|---|---|
| `--color-orange` | `#ef6c1c` | Primary action (buttons, key CTAs), brand mark |
| `--color-orange-dark` | `#d9560d` | Primary hover/pressed |
| `--color-orange-soft` | `#fff0e7` | Orange icon tiles, soft highlights |
| `--color-teal` | `#08737a` | Brand/trust: links, active states, headings emphasis, focus ring |
| `--color-teal-dark` | `#064f56` | Dark bands (trust strip, learning section), teal hover |
| `--color-teal-soft` | `#e6f6f3` | Selected chips, active nav background (`#edf8f6` also OK) |
| `--color-green` | `#16895a` | Success, "done" steps, logo wordmark |
| `--color-blue` | `#115f93` | Learning/courses accent only |
| `--color-blue-soft` | `#e7f1fa` | Blue icon tiles |
| `--color-gold` | `#f0b429` | Coins only |
| `--color-gold-soft` | `#fff8dd` | Coin pill background |
| `--color-gold-ink` | `#765b00` | Text on gold/soft-gold |
| `--color-ink` | `#14262c` | Main text |
| `--color-muted` | `#65747a` | Secondary text |
| `--color-line` | `#dfe8e5` | Borders, dividers |
| `--color-surface` | `#ffffff` | Cards, page |
| `--color-surface-alt` | `#f8fbfa` | Inputs, alternate sections |
| `--color-cream` | `#fff9f1` | Warm sections (Launch Your Brand) |
| `--color-danger` | `#c6411b` | Errors, live badges |
| `--color-danger-soft` | `#fff0ea` | Error backgrounds |

Section gradients from the mockup (hero, learning, offers, quiz) are kept as
named utilities in `globals.css`, not scattered inline.

### Typography

Font: `Inter` for Latin text, with `Noto Sans Devanagari` as a fallback, both
loaded with `next/font`. Hindi quotations use `Noto Serif Devanagari`.

| Style | Size (phone → desktop) | Weight | Line height | Letter spacing |
|---|---|---|---|---|
| Display (hero h1) | 36 → 62 px (`clamp(36px, 4.2vw, 62px)`) | 800 | 1.06 | −0.045em |
| H2 (section title) | 30 → 44 px (`clamp(30px, 3.2vw, 44px)`) | 800 | 1.1 | −0.04em |
| H3 (card title) | 18 → 24 px | 700 | 1.25 | −0.01em |
| Body large | 16 → 18 px | 400 | 1.55 | 0 |
| Body | 15 px (14 minimum) | 400 | 1.55 | 0 |
| Small | 13 px | 500 | 1.45 | 0 |
| Label / eyebrow | 11–12 px, UPPERCASE | 800 | 1.2 | 0.14em |

**Heading pattern.** Section and hero titles have two lines, and the second is
an `<em>` in teal, not italic. For example: "Build your Ayurveda brand.
*We'll build the rest.*" An eyebrow label in teal sits above each section title.

### Spacing, radius, shadow

- Spacing uses a 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 52, 64, 84.
- Page container is `min(1200px, 100% − 40px)`, `100% − 28px` under 820 px and
  `100% − 24px` under 560 px.
- Section vertical padding is 84 px, 64 px under 820 px and 52 px under 560 px.
- Radius tokens:
  - `sm` 8 px (chips, small badges)
  - `md` 12 px (inputs, buttons use 13)
  - `lg` 18 px (small cards)
  - `xl` 22 px (cards)
  - `2xl` 26 px (hero console, modal uses 24)
  - `full` (avatars, pills, coin)
- Shadow tokens:
  - `card`: `0 8px 25px rgba(11,64,67,.04)`
  - `raised`: `0 20px 50px rgba(11,64,67,.11)`
  - `modal`: `0 30px 100px rgba(0,0,0,.3)`
  - `cta`: `0 12px 25px rgba(239,108,28,.22)`, on the primary button only

### Breakpoints

Mobile-first Tailwind breakpoints, matching the mockup's three steps:
`sm` 560 px, `md` 820 px, `lg` 1100 px, `xl` 1280 px. Test at 360, 375, 414,
768, 1024 and 1280 px.

### Motion

150–250 ms, `ease`. Allowed:
- Hover lift of −3 px on cards.
- Modal entry: fade plus 12 px rise.
- Hero slide cross-fade, auto-advancing every 6.5 s and pausing on hover and
  focus.

Everything is off under `prefers-reduced-motion`.

## Components

Components live in `src/components/ui/` (primitives) and
`src/components/site/` (header, footer and other site-level pieces). Every
component is typed, accepts `className`, and appears on the `/design` page with
all its variants.

| Component | Spec (mockup class for reference) |
|---|---|
| **Button** | Variants: `primary` (orange, `cta` shadow), `secondary`/ghost (teal text, `#cddbd7` border, translucent white), `light` (white on dark sections), `link` (teal text). Sizes: `md` 48 px high, `sm` 40 px. Optional trailing arrow icon. Loading state with spinner and `aria-busy`. Full width under 560 px when in a CTA group. (`.btn`, `.btn-primary`, `.btn-ghost`) |
| **IconButton** | 44 × 44 minimum, ghost by default, needs an `aria-label`. |
| **Input** | 48 px high, `surface-alt` background, `line` border, radius 11–12. Label above in 12 px/800. Help text and error text below. Error shows a `danger` border and message linked with `aria-describedby`. |
| **PhoneInput** | Fixed `+91` prefix segment with a divider, `inputmode="numeric"`, `autocomplete="tel-national"`, accepts only 10 digits. (`.phone-input`) |
| **OtpInput** | 6 boxes, numeric, paste support, `autocomplete="one-time-code"`, auto-advance. |
| **PasswordInput** | Show/hide toggle, strength hint on sign-up. |
| **Checkbox** | For the terms and marketing consent lines. |
| **ChoiceChips** | Single-select chips for user type and filters. Selected: `teal-soft` background, teal border and text. Uses `role="radiogroup"`. (`.role-select`, `.filter-row`) |
| **Tabs** | Underline tabs, active in teal with a 2 px bar. (`.catalogue-tabs`) |
| **Card** | White, `line` border, radius `xl`, padding 22–24, `card` shadow; `interactive` variant lifts on hover. |
| **Badge / Eyebrow** | Small uppercase label; variants teal, orange, live (danger dot), soon. (`.eyebrow`, `.live-pill`, `.soon`) |
| **IconTile** | 43 px rounded square with soft tint: orange, teal, blue, gold. (`.quick-icon`) |
| **SectionHeading** | Eyebrow, two-part H2, optional description and "View all →" link on the right (stacked on phones). |
| **Modal / Dialog** | Radix-based, focus-trapped, closes on Esc and backdrop click. Backdrop `rgba(8,31,35,.7)` with 8 px blur. Card is up to 530 px wide, radius 24, padding 32 (26/20 on phones). On phones it becomes a bottom sheet. (`.modal-card`) |
| **Toast** | For success and error messages after actions. |
| **Avatar** | Initials on teal, rounded 11 px square. |
| **CoinPill** | Gold coin icon plus balance and "Coins" label; on phones the icon only. (`.coins-link`) |
| **Stepper** | Horizontal status steps (done = green, active = orange with halo). Used for Track Order. (`.track-example`) |
| **Carousel** | Hero slides with prev/next and dots, swipe on touch. Keyboard accessible, pauses on hover and focus. |
| **HScroller** | Horizontal snap list for reels on phones, with an edge fade. |
| **Skeleton** | Loading placeholders in the shapes of cards and text. |
| **EmptyState / ComingSoon** | Icon, title, one line, optional button. Used wherever an integration is not built yet. |

### Site-level pieces

- **Header** (`.site-header`). A sticky 82 px utility bar (67 px on phones)
  containing:
  - The logo mark and wordmark ("Saatvik" green, "Vaidya" orange, Hindi tagline
    hidden on phones).
  - Search with a ⌘K hint and a popular-searches popover (icon only on phones).
  - The coin pill, the bag with a count, and a profile trigger showing "Sign in
    / Register" or the avatar.
  - Below 375 px the wordmark is 15 px and the gaps are tighter, so the
    signed-in bar (search, coins, bag, profile) fits a 360 px phone with
    every target still 44 px.

  Under the bar sits a section nav rail that scrolls sideways with an edge fade
  and highlights the section currently on screen.
- **Footer.** Brand block, Platform and Support link columns, the assistance
  note with the phone link, a legal row, and links to the policy pages.
- **MobileDock** (`.mobile-dock`). Fixed bottom bar under 560 px with five
  items: Home, My Brand (Launch Your Brand orders, since P2.1), Orders, Coins,
  Profile; the cart is the bag in the header, shown on phones too. Labels
  are 11 px (not the mockup's 8 px). It respects `safe-area-inset-bottom`, and
  the body gets bottom padding so content is not hidden behind it.
- **SkipLink** to `#main`.

## Content rules

- Use sentence case, except eyebrow labels.
- Money is formatted `₹10,000`, using the `en-IN` locale for grouping.
- Phone numbers are shown as `+91 92203 58400`.
- Where an integration isn't built yet (payments, delivery, SMS, WhatsApp), show
  a ComingSoon state with honest text, for example "Online payment is coming
  soon." Never show a button that silently does nothing.
- All user-facing strings are kept in one place per feature (for example
  `src/content/home.ts`), so Hindi can be added later.
