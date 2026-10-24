# Saatvik Vaidya platform plan

Source of truth: the shared plan doc
(https://claude.ai/code/artifact/ed7b7619-6675-4f11-a6c0-14192bbbbe0f). This
file is the in-repo copy for anyone working here, including unattended Octopus
runs. Design rules are in `docs/DESIGN.md`; the client's current UI is in
`docs/mockup-v2/` (the older mockup in `docs/mockup/`).

## Current scope: Stage A (local only)

Build now, running locally only (no hosting yet):

1. **Design system.** Tokens and components from `docs/DESIGN.md`, plus a
   `/design` showcase page.
2. **Site shell.** Header, section nav, footer and mobile dock, as in the
   mockup.
3. **Sign-in system.** Mobile OTP and email + password, with a user type chosen
   at sign-up. SMS and email are **fake senders** that print to the server log.
4. **Homepage.** A faithful, responsive rebuild of the mockup, with content read
   from the database so it can be edited later without code.

**Not in Stage A:** Razorpay, Shiprocket, MSG91, email delivery, WhatsApp, R2,
cart/checkout, catalogue pages, admin panel, deployment. Where the homepage
links to these, show a clear "coming soon" state (see the content rules in
`docs/DESIGN.md`). Build the parts so they can be connected later without
rework.

The Stage A work is split into chunks, listed in `docs/CHUNKS.md`.

## What the product is

A mobile-first website for Saatvik Vaidya, an Ayurveda firm. It has:
- An online store for their medicines.
- Super Coins rewards, like Flipkart SuperCoins.
- An ebook section.
- A private-label service ("Build Your Brand").
- Learning features (quiz, and later courses).

The site is used by customers and Ayurveda professionals, and it is managed from
an admin panel. The client mockup sets the look; this plan sets the features.

## Decisions

| Topic | Decision |
|---|---|
| Look and feel | Match the client's UI v2 in `docs/mockup-v2/` on every screen, site and admin (UI phase, chunks U.1–U.17) |
| Mobile | Fully responsive, designed phone-first |
| User types | Customer, Ayurveda Doctor, Clinic / Hospital, Pharmacy / Store, Stockist / Distributor, plus Admin. Stored as data (a `UserType` table), so admins can add types later |
| Login | Mobile OTP **and** email + password |
| Payments | Razorpay (later) |
| Invoices | Automatic GST invoices (later) |
| Delivery | Shiprocket, with live tracking (later) |
| Super Coins | Fully dynamic: admin-defined earning and redeeming rules, and a ledger (later) |
| Ebooks | Free and paid; paid only for buyers; downloads switchable site-wide and per book by admin (later) |
| Build Your Brand | Private-label request, quote and label-proof flow (Phase 2) |
| Quiz & Win | Weekly quiz with coins and leaderboards (Phase 2) |
| Courses | YouTube-based (Phase 3) |
| Vaidya Community | Phase 3 |
| Partner & Grow | Pathway cards plus a "Request a callback" form, as in the client's UI v2 (chunk U.13) |
| WhatsApp | "Chat on WhatsApp" button first, full integration in Phase 3 |
| Language | English now; all strings kept in content files so Hindi can be added |
| Dynamic site | Content, prices, rules and on/off switches (including maintenance mode) are edited in the admin panel, not in code |
| Hosting | Later, on the client's Hostinger plan (Node.js app + MySQL) |

## Users and roles

| User type | Verification | Notes |
|---|---|---|
| Customer | None | Retail prices (MRP) |
| Ayurveda Doctor | Registration certificate, approved by admin | Professional prices after approval |
| Clinic / Hospital | Clinic registration or GST, approved by admin | As Doctor |
| Pharmacy / Store | Drug licence or GST, approved by admin | As Doctor, plus bulk quantities |
| Stockist / Distributor | Drug licence + GST, approved by admin | As Pharmacy |
| Admin | Invited only; two-factor login required | Admin panel, per-role permissions |

Until approval, a professional account behaves like a Customer account. In
Stage A a user has a `verificationStatus` of `none`, `pending`, `approved` or
`rejected`, with no upload UI yet. Users choose their type at sign-up. Admin
accounts are never self-registered; they are created by a seed script.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js (current stable, App Router, `src/` dir) with TypeScript, strict mode |
| Styling | Tailwind CSS (v4, tokens in `@theme`) |
| UI primitives | Radix UI primitives where behaviour is complex (dialog, tabs, radio group), styled with our tokens |
| Database | MySQL (local Homebrew MySQL now; Hostinger managed MySQL later) with Prisma |
| Auth | Better Auth: email + password and phone-number OTP plugins, Prisma adapter |
| Validation | Zod on every server input |
| Tests | Vitest (unit/integration) and Playwright (end-to-end, phone and desktop viewports) |
| Package manager | pnpm |
| Later | Razorpay, Shiprocket, MSG91, Resend/Hostinger mail, Cloudflare R2, pdf-lib |

## Data model (Stage A subset)

Only what Stage A needs. Later phases add Product, Order, CoinLedger, Ebook and
others, as listed in the full plan.

- **UserType:** key, label, `isProfessional`, `requiresVerification`,
  `sortOrder`, `active`.
- **User** and Better Auth's tables (session, account, verification):
  - `name`, `email` (optional, unique), `phoneNumber` (optional, unique,
    E.164), `phoneNumberVerified`, `emailVerified`.
  - `userTypeId`, `role` (`user` | `admin`), `verificationStatus`,
    `marketingOptIn`, `termsAcceptedAt`.
- **Setting:** key, a JSON value, `updatedAt`, `updatedBy`, plus a
  **SettingHistory** table. Used for the site phone number, footer text, popular
  searches and announcement text.
- **HomeSection:** key, `enabled`, `sortOrder`. Controls which homepage sections
  show and in what order.
- **Homepage content:**
  - HeroSlide
  - Brand
  - Category (form/practice area)
  - Reel (video/image, type filter)
  - Offer
  - Feedback (verified testimonial, image)
  - CourseTeaser / LiveSession teaser
  - StatItem (trust strip)
  - QuickAction
  - WhyStep

  All are seeded from the mockup's content.

## Security rules (apply to every chunk)

- Validate every server input with Zod; never trust the browser.
- Passwords are hashed (Better Auth default). Sessions live in secure, HttpOnly,
  SameSite cookies.
- OTPs: 6 digits, expire in 5 minutes, at most 5 attempts. Rate-limit per phone
  number and per IP (for example 3 sends per 10 minutes).
- Sign-in and sign-up are rate-limited. Error messages never reveal whether an
  account exists.
- The dev OTP/email sender prints to the server log only. The optional dev
  display of the OTP in the UI works only when `NODE_ENV !== "production"` **and**
  `DEV_SHOW_OTP=true`.
- Admin role can only be set by the seed script or the database, never through
  sign-up input.
- No secrets in code or git: use `.env.local` (git-ignored) and keep
  `.env.example` up to date.
- Security headers are set in Next.js config: CSP, X-Frame-Options/
  frame-ancestors, Referrer-Policy, Permissions-Policy.
- Rich text from the database is rendered as plain text or sanitised.

## Later phases (for context)

- **Phase 1 (after Stage A):**
  - Settings, switches and maintenance mode.
  - Catalogue and search, product page, cart, and checkout with Razorpay.
  - GST invoices, and Shiprocket tracking.
  - Notifications and Super Coins.
  - My account, and ebooks.
  - The admin panel (catalogue, orders, users, settings and content, reports).
  - Finishing, a mobile pass and a security review, then deployment.
- **Phase 2:** Build Your Brand, and Quiz & Win.
- **Phase 3:** courses, Vaidya Community, WhatsApp integration and Hindi.
