# Stage A chunks

Run in order, one per Octopus task, each on the `dev` branch. Each chunk ends
with the definition of done in `CLAUDE.md`.

## A1. Scaffold and tooling

- Create and switch to a `dev` branch from `main` if it doesn't exist.
- Create a Next.js app (current stable, App Router, TypeScript strict, `src/`
  dir, import alias `@/`) in the repo root. Keep the existing README, docs and
  CLAUDE.md.
- Add:
  - Tailwind CSS v4.
  - ESLint (Next config) and Prettier.
  - Vitest with Testing Library.
  - Playwright with two projects: `phone` (375×812, touch) and `desktop`
    (1280×800). Install Chromium only.
- Add Prisma for MySQL:
  - `DATABASE_URL` for the local db `saatvik_vaidya`.
  - A test db `saatvik_vaidya_test`.
  - Scripts `db:migrate`, `db:seed`, `db:reset`.
- Add scripts `typecheck`, `lint`, `test`, `test:e2e` and `build` (Playwright
  starts the app itself).
- Set up environment files:
  - `.env.example` listing every variable.
  - `.env.local` for local values.
  - `.gitignore` covering env files, `.next`, test output and `node_modules`.
- Set up folder structure:
  - `src/app`
  - `src/components/ui`
  - `src/components/site`
  - `src/content`
  - `src/server` (db client, auth later, `notify/`)
  - `src/lib`
  - `tests/e2e`
- Add security headers in `next.config` (CSP suited to Next dev/prod,
  frame-ancestors none, Referrer-Policy, Permissions-Policy).
- Add a placeholder home page and one sample unit test and one e2e test.
- Update README with local run steps.

**Done when** `pnpm dev` serves the placeholder page, all checks pass, and
`pnpm db:migrate` connects to local MySQL.

## A2. Design tokens and UI primitives

Implement `docs/DESIGN.md`:
- Tokens in `globals.css` / `@theme`.
- Inter + Noto Sans Devanagari + Noto Serif Devanagari via `next/font`.
- Section gradients as named utilities.
- Reduced-motion handling.

Build every primitive in the Components table: Button, IconButton, Input,
PhoneInput, OtpInput, PasswordInput, Checkbox, ChoiceChips, Tabs, Card,
Badge/Eyebrow, IconTile, SectionHeading, Modal (bottom sheet on phones), Toast,
Avatar, CoinPill, Stepper, Carousel, HScroller, Skeleton and
EmptyState/ComingSoon.
- Use Radix primitives for dialog, tabs and radio group.
- Every component is typed, accessible, and accepts `className`.

Create a `/design` page showing every component and variant, grouped with
headings. Only reachable in development, or behind `SHOW_DESIGN_PAGE=true`.

Tests:
- Unit tests for PhoneInput (10 digits only) and OtpInput (paste,
  auto-advance).
- A Playwright test that loads `/design` on phone and desktop with no console
  errors and no horizontal scroll.
- An axe accessibility check on `/design`.

## A3. Site shell

Build the site-level pieces from `docs/DESIGN.md` using the A2 primitives,
matching the mockup header, nav rail, footer and mobile dock at every
breakpoint:
- Header: logo, search with popular-searches popover and ⌘K, coin pill, bag
  with count, profile trigger.
- Section nav rail with scroll-spy.
- Footer, mobile dock and skip link.
- The profile trigger opens the sign-in modal (a placeholder until A6).
  "Track Order" opens a modal showing the Stepper with a "tracking is coming
  soon" note.
- Search, bag, Orders, Coins and Cart go to a shared ComingSoon page per route
  (`/search`, `/cart`, `/orders`, `/coins`), each with a helpful line and a
  link home.
- Policy links (Privacy, Terms, Shipping, Rewards Policy) go to simple
  placeholder pages.
- Header phone number, footer text and popular searches are read through a
  small `getSetting()` helper with defaults in `src/content/`. In A4 the
  helper switches to reading the database.

Tests:
- Playwright covers phone and desktop: the header is correct, the nav rail
  scrolls, the dock shows only on phone, and all modals open and close with
  Esc and focus return.

## A4. Database schema and seed

Add Prisma models from the Stage A data model in `docs/PLAN.md`:
- UserType, Setting + SettingHistory, HomeSection.
- All homepage content models: HeroSlide, Brand, Category, Reel, Offer,
  Feedback, CourseTeaser, LiveSession, StatItem, QuickAction, WhyStep.

Leave the User and auth tables for A5, but keep the schema organised so they
slot in.

Write an idempotent seed with:
- The 5 user types.
- Default settings (phone `+91 92203 58400`, support note, popular searches,
  footer tagline).
- Every piece of homepage content from `docs/mockup/index.html`, copied
  exactly, including the Hindi lines.
- The mockup assets, copied to `public/media/` and referenced by path.

Add a typed data-access layer, `src/server/content/`, with cached reads:
- `getHomeContent()` returns only enabled sections, in `sortOrder`.
- `getSetting(key)` now reads the database, with defaults as fallback.

Tests:
- Vitest (against the test db) for the seed being idempotent, section
  ordering and visibility, and setting fallback.

## A5. Auth backend

Add Better Auth with the Prisma adapter (generate or migrate its tables):
- **Email + password:** min 8 chars, checked against common passwords.
- **Phone-number OTP plugin:**
  - Indian mobiles only, stored as E.164 `+91XXXXXXXXXX`.
  - 6-digit OTP, 5-minute expiry, max 5 attempts.
  - Sign-up via OTP creates the user.
- **Extra user fields:** `userTypeId` (required at sign-up, must be an active
  UserType), `role` (default `user`, **never settable from client input**),
  `verificationStatus` (`none` for Customer, `pending` for professional
  types), `marketingOptIn`, `termsAcceptedAt` (required).
- **Dev notify sender** (`src/server/notify/`): OTP and password-reset messages
  print to the server log. With `DEV_SHOW_OTP=true` and not production, also
  expose the latest OTP for that phone to the UI via a dev-only route.
- **Password reset** by email (link printed to the log in dev) and by phone
  OTP.
- **Rate limits:**
  - OTP send: 3 per 10 min per phone and 10 per hour per IP.
  - Sign-in: 10 per 15 min per IP.

  Responses are generic, so they never reveal whether an account exists.
- **Session helpers:** `getSession()`, `requireUser()`, `requireAdmin()`.
- Middleware protecting `/account` (and `/admin/**` for later).
- A `pnpm admin:create` script that creates or updates an admin from
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.local`.

Tests:
- Vitest covers: sign-up with each user type, role can't be escalated via
  input, OTP expiry and attempt limit, rate limits, generic errors, and
  password reset.

## A6. Auth UI

Rebuild the mockup's "My Profile" modal as the sign-in / register flow (a
bottom sheet on phones):
- **Mobile tab:**
  - Phone number (+91), then "Continue with OTP".
  - An OTP step with resend timer and change-number option.
  - For new numbers, a short register step: name, "I am a" ChoiceChips with
    all user types from the database (Customer first), terms checkbox
    (required), optional marketing checkbox.
- **Email tab:** sign in, register (same fields plus password) and forgot
  password.
- All errors inline and accessible. Loading states on buttons. Focus moves
  sensibly between steps.
- When signed in:
  - The header shows the avatar with initials and a menu (My account, Sign
    out).
  - The dock Profile item goes to `/account`.
- `/account` is a simple protected page: name, contact, user type, and
  verification status with an explanation ("Professional prices unlock after
  our team verifies your documents — document upload is coming soon").
  Includes sign out.
- In dev with `DEV_SHOW_OTP=true`, show the OTP in a clearly labelled dev
  banner inside the OTP step.

Tests:
- Playwright on phone and desktop covers:
  - Register by phone as Doctor, then sign out and sign in by OTP.
  - Register by email as Customer, then sign in and sign out.
  - A wrong OTP error, and expired or rate-limited messaging.
  - `/account` redirecting when signed out.

## A7. Homepage, part 1 (top half)

Rebuild the mockup homepage from the database content (`getHomeContent()`),
pixel-close at 375 px and 1280 px:
- **Hero carousel:** 3 slides with their right-side panels (Launch Studio
  console, brand showcase, learning board). Launch Studio's buttons open
  ComingSoon. Includes prev/next, dots, swipe and auto-advance with pause.
- **Trust strip.**
- **Saatvik Reels:** filter chips, the two mp4 reels playing inline one at a
  time, image and quote cards, and a horizontal scroller on phones.
- **Current offers.**
- **Start here** quick actions.

Links to unbuilt features go to ComingSoon. Use `next/image` for images and
lazy-load videos with `preload="none"` and poster frames.

Tests:
- Playwright covers: each section renders, the carousel works by keyboard and
  swipe, reel filters work, and there is no horizontal scroll on phone.

## A8. Homepage, part 2 (bottom half)

Continue the homepage from the database content:
- Launch Your Brand steps + catalogue card (form tabs; cards go to
  ComingSoon).
- Top brands, and Courses & Saatvik Live (buttons go to ComingSoon).
- Saatvik Coins panel. When signed in, show the user's coin balance as 0 with
  "earning starts with your first order"; otherwise use the mockup text.
- Quiz & Win teaser (start button goes to ComingSoon), and Verified feedback
  with the letterhead image.
- Vaidya Community teaser.
- Profile completion card, wired to real data when signed in: mobile verified,
  user type selected, and the other steps shown as "coming soon". Signed out,
  it links to sign-in.
- Why Saatvik.

Hiding a section via the HomeSection table (enabled = false) must remove it
and its nav-rail link. The header coin pill shows the real balance (0) when
signed in and is hidden when signed out.

Tests:
- Playwright covers every section on phone and desktop, a disabled section
  disappearing, and the signed-in variants.

## A9. Quality, accessibility and security pass

Go over everything Stage A built:
- **Visual check:** Playwright screenshots of the homepage, sign-in modal
  steps, `/account` and `/design` at 360, 375, 414, 768, 1024 and 1280 px,
  saved to `docs/screenshots/`. Compare against the mockup at the same widths
  and fix differences.
- **Accessibility:** axe checks on those pages must have no serious or
  critical issues.
- **Performance:** run Lighthouse (mobile) on the homepage in a production
  build and fix issues until Performance is 85+, and Accessibility and Best
  Practices are 95+.
- **Security review** of all auth code against the rules in `docs/PLAN.md`:
  - Rate limits, role escalation, session cookie flags and CSRF.
  - Headers/CSP, dev-only routes disabled in production, secrets and
    `.env.example`.
  - `pnpm audit` has no high or critical issues.

  Fix what is found.
- Write a Stage A summary at the top of `docs/PROGRESS.md`: what exists, how
  to run it, test accounts from the seed/admin script, known gaps, and a
  proposed next stage.
