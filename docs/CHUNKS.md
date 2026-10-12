# Phases at a glance

The phases in run order, as they appear in The Den. Details for each chunk are
further down this file. Progress lives in `docs/PROGRESS.md` and The Den, not
here.

1. **Stage A: Foundation** (done)
   - A1 Scaffold and tooling
   - A2 Design tokens and UI primitives
   - A3 Site shell
   - A4 Database schema and seed
   - A5 Auth backend
   - A6 Auth UI
   - A7 Homepage, part 1
   - A8 Homepage, part 2
   - A9 Quality, accessibility and security pass
2. **Phase 1: Store and admin**
   - P1.1 Admin dashboard: users and approvals
   - P1.2 Professional document uploads and verification
   - P1.3 Catalogue and product pages
   - P1.4 Cart, checkout and test payment
   - P1.5 Orders and test delivery tracking
   - P1.6 GST invoices
   - P1.7 Super Coins
   - P1.8 Ebooks
   - P1.9 Site settings, maintenance mode and homepage editing
   - P1.10 My account and admin reports
   - P1.11 Admin security and permissions
   - P1.12 Phase 1 quality and security pass
3. **Phase 2: Launch Your Brand and Quiz & Win**
   - P2.1 Launch Your Brand: branded ordering
   - P2.2 Launch Your Brand: label proof and production
   - P2.3 Quiz & Win
   - P2.4 Phase 2 quality and security pass
4. **Go-live** (only once client keys are ready; a person deploys)
   - G.1 Razorpay payments
   - G.2 Shiprocket delivery
   - G.3 SMS and email
   - G.4 File storage
   - G.5 WhatsApp Business API
   - G.6 Deploy to Hostinger
5. **Phase 3: Learning and community**
   - P3.1 Courses and Saatvik Live
   - P3.2 Vaidya Community
   - P3.3 WhatsApp chat button
   - P3.4 Hindi
   - P3.5 Phase 3 quality and security pass
6. **UI Design: client UI v2** (every screen restyled to `docs/mockup-v2/`)
   - U.1 Design system v2: tokens, fonts and DESIGN.md
   - U.2 UI primitives in the v2 style
   - U.3 New shared components
   - U.4 Site shell v2
   - U.5 Homepage v2, part 1
   - U.6 Homepage v2, part 2
   - U.7 Top Brands: catalogue, product page and search
   - U.8 Launch Your Brand screens
   - U.9 Cart, checkout, orders and Track Order
   - U.10 Quiz & Win
   - U.11 Saatvik Coins and My Profile
   - U.12 New pages: Courses and Dr. Talk
   - U.13 New pages: Real Feedback, Why Saatvik, Partner & Grow
   - U.14 Remaining site screens
   - U.15 Admin portal v2: shell and shared admin components
   - U.16 Admin portal v2: every admin page
   - U.17 UI quality, accessibility and security pass

---

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

---

# Phase 1 chunks

## P1.1. Admin dashboard: users and approvals

Build the admin panel foundation at `/admin`:

**Admin Dashboard (`/admin`)**
- Protected route with `requireAdmin()`
- Sidebar navigation: Users, Content (Reels, Brands, Courses, Quiz), Orders, Settings
- Dashboard summary card (total users, pending approvals, total orders, etc.)

**Users Management (`/admin/users`)**
- Table: name, email/phone, user type, verification status, actions
- Filter by: user type, verification status (none/pending/approved/rejected)
- Bulk actions: approve, reject, delete (with confirmation)
- Detail view on row click: full user info, verification documents (placeholder), approve/reject with notes
- Search by name/email/phone

**Doctor/Professional Approvals (`/admin/approvals`)**
- List of pending professional accounts only
- Columns: name, type (Doctor/Pharmacy/etc.), submitted date, status
- One-click approve/reject with optional comment
- Document upload simulation (placeholder UI for now, actual upload in P1.2)

**Add/Modify Users (`/admin/users/new`, `/admin/users/:id/edit`)**
- Form: name, email, phone, user type, role (user/admin), verification status
- Validation with Zod
- Create new admin users
- Edit existing users

**Reels Management (`/admin/content/reels`)**
- Table: key, title, type (video/image/quote), active status, sort order
- Add/edit/delete reel
- Form: title, description, type, media path/URL, duration, sort order, active toggle
- Inline preview

**Brands Management (`/admin/content/brands`)**
- Table: name, logo, active status, sort order
- Add/edit/delete brand
- Form: name, description, logo upload/path, sort order, active toggle

**Courses Management (`/admin/content/courses`)**
- Table: title, instructor, duration, active status, sort order
- Add/edit/delete course
- Form: title, description, instructor, video URL/embed, sort order, active toggle

**Quiz Management (`/admin/content/quiz`)**
- Create/edit quiz
- Form: title, description, questions (add multiple), answer options, correct answer, points
- Question builder interface
- Sort questions

**Orders View (`/admin/orders`)**
- Table: order ID, customer, total, status, date
- Filter by status, date range
- Click to see order details (items, shipping address, payment status)
- Placeholder for now (actual orders in Phase 1.3)

**Database changes:**
- Add `AdminLog` table (userId, action, resource, changes, timestamp) for audit trail

**Tests:**
- Playwright on admin dashboard, users list, approvals, content management, orders
- Authorization: non-admins get 404
- CRUD operations for users, reels, brands, courses, quiz
- Bulk approve/reject

**Checks:**
- `pnpm typecheck`, `lint`, `test`, `test:e2e` and `build` all pass
- Admin pages at 375 px and 1280 px match expected layout
- No sensitive data in logs or responses

**Known gaps:**
- No actual document upload yet (file validation UI placeholder)
- No email notifications when approving/rejecting
- Orders are placeholder (no real payment/order system yet)
- No admin two-factor login yet
- Bulk delete has no undo

---

## P1.2. Professional document uploads and verification

Add verification flow for professionals:

**Professional Account Page (`/account` for professionals)**
- Verification status badge: none/pending/approved/rejected
- Document upload form:
  - Doctor: upload registration certificate
  - Pharmacy: upload drug licence + GST
  - Clinic: upload clinic registration + GST
  - Stockist: upload drug licence + GST
- Upload progress, file preview
- Status: "Pending review" with date submitted
- Reject reason (if rejected) with re-upload prompt

**Admin Verification Review (`/admin/approvals/detail/:userId`)**
- View uploaded documents (PDF preview)
- Download documents
- Approve/reject with optional comment
- Comment history

**Database:**
- `ProfessionalDocument` table: userId, documentType, fileUrl, uploadedAt, verifiedAt
- `VerificationComment` table: userId, comment, approvedBy, timestamp

**File storage:** a `Storage` interface in `src/server/storage/` with a local-disk
implementation (outside `public/`, served only through an authorised route,
type and size checked on the server). R2 replaces it later; later chunks reuse
it for product images and ebooks.

**Notifications (dev log for now):**
- Confirmation email when upload succeeds
- Notification to admin when document uploaded
- Approval/rejection email to professional

**Tests:**
- Upload different file types (PDF, JPG)
- File size limits
- Reject flow and re-upload
- Admin review and approval

---

## P1.3. Catalogue and product pages

The cart needs products, so the catalogue comes first.

- **Models:** `Product` (slug, name, brand, form/practice-area category from the
  existing `Category`, description, ingredients, dosage, pack size, MRP,
  professional price, GST rate, HSN code, stock, MOQ, active, featured,
  sortOrder), `ProductImage`, and `BulkPriceTier` (product, min quantity,
  price). Money is stored in paise as integers.
- **One pricing function** in `src/server/pricing/`, used everywhere a price is
  shown or charged:
  - Customer, signed out, or an unapproved professional: MRP.
  - Approved Doctor and Clinic / Hospital: professional price.
  - Approved Pharmacy / Store and Stockist / Distributor: professional price
    plus bulk tiers.
- **Pages:**
  - `/products`: listing with filters (form, practice area, brand), sort
    and pagination.
  - `/products/[slug]`: gallery, details, the price the viewer gets, and
    "Add to cart" (shows coming soon until P1.4).
  - `/search`: real results.
  - Homepage and hero links that point at the catalogue now go to these
    pages.
- **Admin `/admin/catalogue`:** create/edit/deactivate products, prices, bulk
  tiers, stock and images (through the P1.2 `Storage`).
- **Seed:** about 12 sample products, clearly marked as sample data, since no
  real catalogue has been supplied.
- **Tests:**
  - Vitest for the pricing rules per user type and status.
  - Playwright for listing, filters, search and the product page, including
    that professional prices show only after approval.

## P1.4. Cart, checkout and test payment

**No real payment gateway.** Razorpay is a later ticket (see "Parked" below).

- **Cart:**
  - Guests get a cart tied to an anonymous cookie, merged into their account
    when they sign in.
  - Signed-in carts live in the database.
  - `/cart` has quantity changes and removal, respects MOQ and stock, and
    shows totals from the pricing function.
  - The header bag count becomes real.
- **Addresses:** an `Address` model (saved addresses, Indian PIN code and state
  validation). Add, edit and pick an address at checkout.
- **Checkout `/checkout`** (sign-in required):
  - Address, order summary with GST breakdown, and a shipping fee from a
    setting.
  - Prices are recomputed on the server at every step; the browser never
    sends prices.
- **Orders:**
  - `Order` and `OrderItem`. Items snapshot name, price and GST rate.
  - Statuses: `pending_payment`, `paid`, `payment_failed`, `cancelled`,
    `processing`, `shipped`, `delivered`.
  - A `Payment` record: provider, reference, amount, status, attempt number.
- **Test payment:**
  - A `PaymentProvider` interface in `src/server/payments/` with a `test`
    implementation, chosen by `PAYMENT_PROVIDER=test`.
  - Placing an order opens `/checkout/pay/[orderId]`, a screen clearly
    labelled "Test payment - no money is taken" with two buttons: **Simulate
    success** and **Simulate failure**.
  - **Success:** the order becomes `paid`, stock goes down, the cart
    empties, a confirmation page shows, and a dev-log notification is sent.
  - **Failure:** the order becomes `payment_failed`, and a failure page offers
    "Try again" (a new attempt on the same order) and "Back to cart". Stock and
    cart are unchanged.
  - Both outcomes are idempotent: a double click or replay never
    double-counts.
  - The test provider refuses to run when `NODE_ENV=production`, so it can't
    go live by accident.
  - Razorpay later implements the same interface (create payment, verify
    signature/webhook) with no changes to checkout.
- **Tests:** Playwright runs the full flow twice, once ending in success and
  once in failure then retry to success. Vitest covers totals, GST, stock and
  idempotency.

## P1.5. Orders and test delivery tracking

**No real Shiprocket.** Real tracking is a later ticket (see "Parked" below).

- **Customer:** `/orders` (replaces the coming-soon page) lists their orders,
  and `/orders/[id]` shows items, totals, address, payment and a tracking
  timeline.
- **Admin `/admin/orders`:** real list (replaces the P1.1 placeholder) with
  filters by status and date, a detail page, and cancel (restocks).
- **Test shipping:**
  - A `ShippingProvider` interface in `src/server/shipping/` with a `test`
    implementation, chosen by `SHIPPING_PROVIDER=test`.
  - "Create shipment" on a paid order returns a fake courier name and AWB
    number.
  - A `ShipmentEvent` log records each step.
  - The admin can move a shipment forward through Packed, Shipped, In transit,
    Out for delivery and Delivered, or mark it Undelivered / Returned, with a
    "Simulate next step" button.
  - Each change updates the order status and sends a dev-log notification.
  - Shiprocket later implements the same interface (create shipment, webhook
    events).
- **Track Order:**
  - The header/footer modal and a `/track` page take an order number plus the
    phone or email on the order, and show the real timeline.
  - Rate-limited, and never reveals whether an order exists for wrong
    details.
- **Tests:** Playwright covers order history, the admin moving a shipment
  through every step, and a customer seeing each step on the tracking page.

## P1.6. GST invoices

- On payment success, generate a GST tax invoice PDF with pdf-lib.
- **Invoice contents:**
  - Seller name, address and GSTIN from settings (placeholder values seeded).
  - A sequential invoice number per financial year.
  - HSN codes and taxable value.
  - CGST + SGST for the seller's state, IGST otherwise.
  - Totals in figures and words.
- Store the invoice through `Storage`.
- Download links on the customer's order page and in admin, with owner/admin
  checks.
- Cancelling a paid order creates a credit note.
- **Tests:** Vitest for tax splits, rounding and numbering (including
  concurrency); Playwright for download access rules.

## P1.7. Super Coins

- **Admin-defined rules** in `/admin/coins`:
  - Coins earned per ₹ spent.
  - Earning after delivery.
  - Profile-completion rewards (250 and 750, as in the mockup).
  - Coin value in ₹ and maximum redemption per order.
  - Expiry.
  - Switch the whole programme on/off.
- **`CoinLedger`:** every credit and debit with reason and reference. The
  balance is always the ledger sum, never a stored number that can drift.
- **Customer:**
  - The header coin pill shows the real balance.
  - `/coins` shows the balance, history and how to earn.
  - Checkout can redeem coins within the rules.
  - A failed payment or a cancellation returns redeemed coins.
- **Admin:** manual adjustments with a required reason (logged in `AdminLog`).
- **Tests:** Vitest for earning, redeeming, caps, expiry and reversal;
  Playwright for redeeming at checkout.

## P1.8. Ebooks

- `Ebook` model: title, cover, description, file (in `Storage`), free or paid,
  price, active.
- **Pages:** `/ebooks` listing and detail pages.
- **Free books:** download for signed-in users.
- **Paid books:** bought through the normal cart and test payment. They can
  then be downloaded only by buyers, from `/ebooks` and their account.
- **Downloads:**
  - Go through an authorised route that streams the file.
  - Never a public URL.
  - Rate-limited.
- **Switches:** downloads on/off site-wide and per book (admin). When off, the
  page says downloads are paused.
- **Admin `/admin/ebooks`:** create, edit, upload and deactivate.
- **Tests:** access rules (guest, free, paid non-buyer, buyer, switch off).

## P1.9. Site settings, maintenance mode and homepage editing

- **Admin `/admin/settings`:**
  - Edit every `Setting`: phone, support note, popular searches, footer
    tagline, announcement bar, shipping fee, and the seller details for
    invoices.
  - Every change writes `SettingHistory`, with `updatedBy` as a real relation
    to `User`.
- **Switches:** checkout on/off, coins on/off, ebook downloads, and
  **maintenance mode**.
  - Maintenance mode shows a branded page to everyone except signed-in
    admins, and keeps `/api/auth` working so admins can sign in.
- **Admin `/admin/content`:** manage the remaining homepage content (hero
  slides, offers, stats, quick actions, categories, feedback, why-steps), plus
  section on/off and order.
- **Saves:**
  - Validated with the existing Zod schemas.
  - Call `revalidateTag` so changes show immediately.
- **Seed:** make content seeding create-only, so re-seeding never overwrites
  admin edits.
- **Tests:**
  - Editing a setting and a homepage item shows on the site.
  - Maintenance mode blocks visitors but not admins.

## P1.10. My account and admin reports

- **`/account`:**
  - Edit name, change password, and manage saved addresses.
  - Email verification link (through the dev notifier).
  - Notification preferences.
  - Links to orders, coins, ebooks and verification.
- **Admin `/admin/reports`:**
  - Sales by day/week/month.
  - Orders by status.
  - Top products.
  - New users by type.
  - Pending approvals.
  - Coins issued/redeemed.
- **CSV export** of orders and users, admin only, and logged.
- **Tests:** reports match seeded orders; CSV export access rules.

## P1.11. Admin security and permissions

- **Two-factor login for admins** (TOTP, Better Auth's two-factor plugin, with
  backup codes).
  - Required before any `/admin` page loads.
  - `pnpm admin:create` still works and forces 2FA setup at first sign-in.
- **Per-role admin permissions:**
  - Roles such as super admin, catalogue, orders, content and approvals.
  - Checked on the server for every admin action, not just hidden in the
    menu.
- **Admin invites:**
  - A super admin invites by email (dev notifier).
  - Admins are still never self-registered.
- `AdminLog` covers every admin write.
- **Tests:**
  - 2FA is enforced.
  - Each role is refused outside its area.
  - Invite flow.

## P1.12. Phase 1 quality and security pass

Like A9, over everything Phase 1 built:
- Screenshots at 360-1280 px, and a mobile pass on every new page.
- axe with no serious/critical issues.
- Lighthouse on the homepage, product page and checkout.
- **Security review:**
  - Uploads.
  - Payment and shipping state changes.
  - Price tampering.
  - Admin permissions.
  - Rate limits.
  - Download access.
  - `pnpm audit`.
- Write a Phase 1 summary at the top of `docs/PROGRESS.md`, including a
  launch checklist for the parked tickets and the real providers (MSG91,
  email, R2, Hostinger). **Do not deploy.**

---

## Parked

The real integrations are in the **Go-live** chunks at the end of this file.

---

# Phase 2 chunks

Run after P1.12. Same rules as Phase 1: no real integrations (test payment,
dev notifier, local storage), every chunk meets the definition of done.

## P2.1. Launch Your Brand: branded ordering

Client requirement (2026-10-02): any customer or professional can order a
product in their own brand packaging. They pick a product, upload their logo,
fill in the packaging details, choose a quantity and place the order. This
replaces the earlier quote-first design.

- **Who:** any signed-in user, of any user type and verification status.
- **Eligible products:** `Product.brandEligible`, `Product.brandMinQty` (the
  minimum, which is also the step), `Product.brandUnitPrice` (paise) and a
  unit label (for example "bottles"). These are edited in `/admin/catalogue`.
  - The client will send a sheet of eligible products and their minimums.
  - Add an admin CSV import (product slug or name, minimum, price, unit) that
    shows a preview with errors per row before applying.
  - Until the sheet arrives, seed sample values on a few sample products.
- **`/launch`** (sign-in required): steps with the Stepper, saved as a draft
  between steps.
  1. **Product:** search and form tabs, eligible products only, showing the
     minimum and the brand price.
  2. **Packaging:**
     - Logo upload (PNG, JPG or PDF through `Storage`, type checked from the
       bytes; no SVG).
     - Brand name (required), tagline, "Marketed by" name and address,
       contact number and a notes box.
     - Zod limits on every field.
  3. **Quantity:**
     - Starts at the minimum.
     - **+ adds the minimum and − takes it off** (minimum 4 gives 4, 8, 12 ...),
       never below the minimum.
     - The server rejects any quantity that isn't a positive multiple of the
       minimum.
     - The price, GST and total update as it changes.
  4. **Review and pay:** a summary with the logo preview, then the P1.4 test
     payment (simulate success or failure, retry on failure).
- **Orders:**
  - Reuse `Order` / `OrderItem` / `Payment` from P1.4 with an order type of
    `store` or `brand`.
  - One product per brand order. (Since 2026-10-03 an order can hold several
    products through the Launch cart; see "Launch page: bulk-order Launch
    cart" in `docs/PROGRESS.md`.)
  - A `BrandOrderDetails` record holds the logo and packaging fields.
  - Brand orders don't go through the normal cart, and the **normal store
    cart keeps +1 / −1** with its existing minimum check.
- **Customer "My Brand" `/my-brand`:** the list of brand orders, and a detail
  page with the details and a status timeline. The mobile dock's Cart item
  becomes **My Brand** (DESIGN.md), and the cart stays reachable from the
  header.
- **Admin `/admin/brand-orders`:** list with filters, and a detail page with
  the logo download, packaging details and the customer's contact.
- Hero Launch Studio buttons, "Start a private-label request", "Launch Your
  Brand" and "Start your brand" links go to `/launch`.
- **Notifications (dev log):** to the admin on a paid brand order, and to the
  customer on payment.
- **Tests:**
  - Vitest for step and minimum rules, brand pricing and the CSV import.
  - Playwright for the full flow on phone and desktop (including + / −
    stepping by the minimum, payment success and failure), and the admin
    view.

## P2.2. Launch Your Brand: label proof and production

After a brand order is paid, the team sends a packaging proof before anything
is printed.

- **Statuses:** `awaiting_proof`, `proof_sent`, `changes_requested`,
  `proof_approved`, `in_production`, `quality_check`, `dispatched`,
  `delivered` and `cancelled`. The server enforces which status can follow
  which, and every change is logged with who made it and a note.
- **Proofs:**
  - The admin uploads a proof (PDF or image through `Storage`).
  - The customer approves it or requests changes with a comment on
    `/my-brand/[id]`.
  - Every version is kept and shown.
  - Production can't start until a proof is approved.
- **Production:**
  - The admin moves the order through In production, Quality check,
    Dispatched (using the P1.5 test `ShippingProvider`) and Delivered.
  - The customer sees the mockup's stepper (Confirmed, Production, Quality
    check, Dispatch).
- **Cancel:** an admin can cancel before production, which records a test
  refund through the `PaymentProvider`.
- **Documents:**
  - The GST invoice comes from P1.6.
  - Logos and proofs can be downloaded by the owner and admins only.
- **Notifications (dev log):** to the customer on each proof and status
  change, and to the admin on approval or a change request.
- **Tests:**
  - Playwright for paid order, then proof, then changes requested, then a new
    proof, then approval, then production, then delivered.
  - Vitest for the status rules and access checks.

## P2.3. Quiz & Win

Built on the P1.1 quiz models.

- **Weekly quiz:**
  - The admin schedules a quiz for a week (start/end), from `/admin/content/quiz`.
  - Each quiz is 10 questions with a 5-minute limit, as in the mockup.
  - One attempt per user per quiz.
- **Playing `/quiz`** (sign-in required):
  - Questions are served without the correct answers.
  - The timer is enforced on the server (the attempt's start time; late
    answers are not counted).
  - Progress survives a refresh.
  - Answers and explanations are shown after submitting.
- **Coins:**
  - A qualifying score (admin-set threshold) credits coins through the P1.7
    `CoinLedger`, once per attempt.
  - The amount comes from a new coin rule.
- **Leaderboards `/quiz/leaderboard`:**
  - Weekly and monthly.
  - Ranked by score, then by time taken.
  - Show first name + last initial only.
  - The signed-in user sees their own rank.
- **Homepage:** the Quiz & Win section and the "Play this week's quiz" links
  show the live quiz, or "next quiz starts ..." when none is open.
- **Tests:**
  - Vitest for scoring, the timer, the single attempt and the coin credit.
  - Playwright for play-through, timeout, and leaderboard display on phone and
    desktop.

## P2.4. Phase 2 quality and security pass

Like P1.12, over P2.1–P2.3:
- Screenshots at 360–1280 px.
- axe with no serious/critical issues.
- **Security review:**
  - Brand order ownership checks.
  - Quantity-step and price tampering.
  - Status-transition and proof-approval tampering.
  - Proof and logo upload handling.
  - Quiz answer leakage and timer bypass.
  - Coin double-credit.
- Write a Phase 2 summary in `docs/PROGRESS.md`. **Do not deploy.**

---

# Phase 3 chunks

Run after Phase 2. Same rules: no real integrations, and every chunk meets the
definition of done.

## P3.1. Courses and Saatvik Live

YouTube-based courses (PLAN), building on the P1.1 course admin.

- **Courses:**
  - `/courses` lists the courses.
  - `/courses/[slug]` shows the course details and its lessons as YouTube
    embeds (`youtube-nocookie.com`, added to the CSP `frame-src`).
  - Course access is set per course: free, signed-in, or approved
    professionals only.
  - Signed-in learners see lesson progress.
- **Saatvik Live:**
  - Admin-scheduled sessions (title, Hindi subtitle, speaker, date/time,
    format).
  - **Reserve seat** for signed-in users, with a dev-log reminder.
  - The join link shows only to people who reserved, shortly before the
    start.
  - Past sessions can link a recording.
- **Admin:** manage courses, lessons, sessions and the list of reservations.
- Homepage "Explore all courses", "View course" and "Reserve seat" link to
  these pages.
- **Tests:**
  - Access rules.
  - Reservation and join-link timing.
  - Progress.
  - Playwright on phone and desktop.

## P3.2. Vaidya Community

From the mockup: "A verified space for clinical discussions, classical
references and professional growth".

- **Who:**
  - Reading is open to signed-in users.
  - Posting and answering is for approved professionals only.
- **Discussions:**
  - Two kinds: case discussions and questions.
  - Plain-text bodies (sanitised) with optional images through `Storage`.
  - Tags by practice area.
  - Replies, and an "accepted answer" on questions.
- **De-identified cases:**
  - Posting a case needs a "no patient-identifying details" confirmation.
  - The server blocks phone numbers, emails and Aadhaar-like numbers in
    posts.
- **Recognition:**
  - Helpful votes and contributor badges.
  - Optional coin rewards through the P1.7 rules.
- **Moderation:**
  - Users can report a post.
  - The admin queue can hide, restore or delete.
  - Rate limits on posting.
- The homepage "Join early access" link goes to `/community`.
- **Tests:**
  - Posting rules by user type.
  - Identifier blocking.
  - Moderation.
  - Playwright on phone and desktop.

## P3.3. WhatsApp chat button

- A "Chat on WhatsApp" button (a `wa.me` link to the site's WhatsApp number,
  which is a new setting) in the footer, product pages, order pages and Launch
  Your Brand, with a prefilled message (for example the order number).
- A WhatsApp channel in `src/server/notify/` with a dev implementation that
  logs messages.
- The full WhatsApp Business API is a Go-live chunk.

## P3.4. Hindi

- An English/Hindi switch in the header (remembered per user and in a
  cookie), with `lang="hi"` on Hindi pages.
- Hindi versions of every `src/content/` string, drafted and marked **for
  client review** in a list in `docs/PROGRESS.md`.
- Admin-editable content gets optional Hindi fields that fall back to English
  when empty.
- Numbers, dates and prices are formatted per language.
- **Tests:** switching, fallback, and no missing keys.

## P3.5. Phase 3 quality and security pass

Like P2.4, over P3.1–P3.4:
- Screenshots in both languages.
- axe.
- **Security review:**
  - Community content and uploads.
  - Course access.
  - The CSP for YouTube.
- Write a Phase 3 summary. **Do not deploy.**

---

# Go-live chunks

The real integrations, then hosting. **Don't start these until** the client's
accounts and keys are ready and CLAUDE.md's "No real integrations yet" rule
has been updated to allow them. Keys go in `.env.local` on the server only,
never in git. Each one replaces a test or dev implementation behind its
existing interface, and the test one stays for development.

## G.1. Razorpay payments

- A `razorpay` `PaymentProvider`: orders API, checkout script, signature
  check, webhooks (verified, idempotent) and refunds.
- The CSP and Permissions-Policy changes it needs.
- Test-mode keys first.

## G.2. Shiprocket delivery

- A `shiprocket` `ShippingProvider`: create shipment, AWB, pickup and
  tracking webhooks.
- Shiprocket statuses mapped onto ours.

## G.3. SMS and email

- MSG91 for OTP and order SMS, with DLT templates.
- Resend or Hostinger mail for email.
- Hash stored OTPs.
- Make sure the dev sender can never run in production.

## G.4. File storage

- An R2 implementation of `Storage`.
- Migrate existing local files, with private and public buckets as needed.

## G.5. WhatsApp Business API

- A real WhatsApp channel in `src/server/notify/` for order and Launch Your
  Brand updates, with approved templates and opt-in.

## G.6. Deploy to Hostinger

Done by a person, not Octopus; CLAUDE.md forbids agents deploying. Octopus
may prepare it:
- A deployment checklist in `docs/DEPLOY.md`: Node version, environment
  variables, migrations, seed, admin creation, HSTS, trusted proxy for rate
  limits, backups and monitoring.
- A production smoke test.


---

# UI phase chunks (client UI v2)

The client sent their full UI for the website on 2026-10-12. It is saved in
`docs/mockup-v2/` (homepage `index.html`, every inner page in
`portal.html?view=...`, screenshots of every view at 375 and 1280 px in
`screens/`). This phase restyles **every screen**, site and admin, to match
it. Run the chunks in order, one per Octopus task, on `dev`. Each ends with
the definition of done in `CLAUDE.md`.

## Rules for every UI chunk

- **Match the client UI.** Compare each screen with `docs/mockup-v2/screens/`
  (and the live HTML, served locally) at 375 and 1280 px: colours, type,
  spacing, radius, shadows, layout and order of sections. Where matching it
  exactly would break an accessibility rule in `docs/DESIGN.md` (contrast,
  44 px targets, 14 px body, 11 px labels), keep the rule, get as close as it
  allows, and note the difference in DESIGN.md.
- **Reusable components, no one-offs.** Screens are built from
  `src/components/ui/` and `src/components/site/`. If a pattern shows up on
  two screens it is a component, not copied markup. Every new or changed
  component is typed, takes `className`, and is on `/design` with all its
  variants. Use tokens only, never raw colour values.
- **Presentation only.** Keep every route, server action, API route, Zod
  schema, auth check, rate limit, permission and query as it is, unless the
  chunk says otherwise. Don't loosen the CSP; fonts come through `next/font`
  (self-hosted), so no new external origins.
- **Real data, honest states.** The mockup's sample data (doctor names, posts,
  leaderboard rows, prices, order numbers, "DA" avatar) is illustration only.
  Show real data from the database. Where a feature doesn't exist yet, show
  the v2 "Coming next" state. Don't add buttons that do nothing (Wishlist,
  Follow, Share, Set Reminder and similar): leave them out or show them as
  coming soon.
- **Text** goes in `src/content/`, and content admins edit stays in the
  database.
- **Tests.** Update Playwright tests whose text or selectors change, and add
  them for new pages, at 375 and 1280 px with axe and the horizontal-overflow
  check. Never delete or skip a failing test to get green.
- **Shared working tree.** The tree may contain someone else's uncommitted
  work (for example a brand-order "Update status" change in
  `src/server/brand/`, `src/lib/brand-stage.ts` and `docs/PROGRESS.md`).
  Don't commit, revert or stash it. Stage only your own files by path. If
  `docs/PROGRESS.md` already has unrelated uncommitted edits, add your entry
  without touching them and commit only your hunk (`git add -p`).

## U.1. Design system v2: tokens, fonts and DESIGN.md

- Rewrite `docs/DESIGN.md` for v2, from `docs/mockup-v2/styles.css` and
  `portal.css`:
  - colours: forest green brand, orange action, gold coins, paper and cream
    backgrounds;
  - type: Manrope for headings and DM Sans for body, with Noto Sans
    Devanagari kept as the Hindi fallback;
  - the radius, shadow, spacing and container values;
  - the heading pattern (second line in orange or gold, not teal) and the
    eyebrow with a short orange line before it;
  - motion (scroll reveal, off under reduced motion);
  - a component table updated for v2.
  Keep the principles and content rules. Record every deliberate difference
  from the mockup.
- `src/app/globals.css`:
  - Replace the token values with v2.
  - Rename colour tokens to role names where the role changed (for example
    `teal*` becomes `brand*` for the forest green) and update every use in
    the codebase in the same chunk, so no stale names are left.
  - Keep AA-safe text steps for white on orange, as today with
    `orange-strong`.
  - Add the v2 gradients (dark green hero, gold quiz/coins, product pack
    colours) as named utilities.
- `src/app/layout.tsx`: load Manrope and DM Sans with `next/font` in place of
  Inter, and expose them as `--font-heading` and `--font-body`.
- `/design` shows the new palette and type scale.
- Expect many screens to change colour in this chunk. Fix any test that
  asserts on old colours or class names, and check that contrast tests still
  pass.

## U.2. UI primitives in the v2 style

Restyle every component in `src/components/ui/` to v2:
- Button: dark green solid, orange primary with soft glow, soft outline and
  link variants.
- Inputs, select and textarea: cream fill, rounded 12–14 px.
- Checkbox, choice chips (rounded pills, dark green when selected), tabs as
  pill tabs.
- Card: white, 24 px radius, the soft v2 shadow; featured gold and dark green
  variants.
- Badge and pill: green, orange, blue and gold tones, "In stock", "Coming
  next".
- Icon tile, avatar (rounded square, green gradient), coin pill (Coins / MY
  WALLET).
- Modal (bottom sheet on phones), toast, skeleton, empty state and coming
  soon, carousel, horizontal scroller.

Every variant goes on `/design`. Keep the APIs, or update the callers in the
same chunk.

## U.3. New shared components

Add the patterns the v2 pages repeat, each in `src/components/ui/` (or
`site/` if it is site-specific), on `/design`, with Vitest tests for any
logic:
- **PageHero**: the dark green inner-page hero with dotted texture, orange
  eyebrow, big Manrope title, description, and the "BUILT FOR PROFESSIONALS"
  side note card (stacks under the text on phones).
- **SectionHeading** v2: eyebrow, two-tone title, optional description on the
  right and a "View all →" link.
- **StatStrip**: the 4-up gold-number stats band (2 × 2 on phones).
- **FilterBar**: search field and select filters in one row, stacking on
  phones.
- **PillTabs**: the tab group used on Dr. Talk, Courses, Feedback and the
  leaderboard.
- **ProgressBar**.
- **StepsBar**: the numbered 1–2–3 steps strip.
- **Stepper** v2: the Track Order dots-and-line progress.
- **Drawer**: side sheet on desktop, bottom sheet on phones; focus trapped.
- **RankList**: the leaderboard rows.
- **MediaCard**: reel and feedback cards with tag, play overlay and caption.
- **InfoCard**: icon tile, number, title, text and link, used by Why Saatvik,
  Partner and Coins.
- **QuantityStepper**: promote from `site/cart` and reuse it everywhere.

## U.4. Site shell v2

Rebuild the site shell to v2, as one set of shared components used on every
site page:
- **Announcement bar**: orange, with the coins message from settings.
- **Header**:
  - the client's `logo.png` as the logo (copy it to `public/brand/` and use
    `next/image` with alt text);
  - search with the ⌘K hint;
  - the Coins "MY WALLET" pill;
  - "My Profile / Sign in / Register", or the signed-in avatar;
  - the cart bag stays, styled to match.
- **Nav rail**:
  - pill items, with Dr. Talk as a dark green pill and Quiz & Win as an
    orange pill;
  - scrolls sideways on phones and marks the active page;
  - links go to real routes: `/`, `/dr-talk`, `/quiz`, `/launch`,
    `/products`, `/courses`, `/coins`, `/track`, `/feedback`, `/partner`,
    `/why`.
  - Routes that don't exist yet (`/dr-talk`, `/courses`, `/feedback`,
    `/partner`, `/why`) get a simple coming-soon page now; U.12 and U.13
    replace them.
- **Mobile dock**: Home, Dr. Talk, Launch, Orders, Profile, as in v2. Update
  DESIGN.md's dock section.
- **Footer**: dark green, with the logo, tagline, Community / Products /
  Support columns, the phone number, the legal row, and links to the policy
  pages, which stay.
- **Sign-in modal**: restyle to v2 ("Continue with mobile OTP"). The flows,
  validation and rate limits stay exactly as they are.

## U.5. Homepage v2, part 1

Following `docs/mockup-v2/index.html` and `screens/*-home.jpg`:
- **Hero**: dark green, "Learn. Connect. / Build. Grow.", two buttons and
  ticks. Add the "Your Saatvik journey" panel with its four tiles (Dr. Talk,
  Quiz & Win, Launch Your Brand, Business Opportunities), each linking to its
  page.
- **StatStrip** under the hero, from the `StatItem` rows.
- **"Start with the community"**:
  - The Dr. Talk card shows a Coming next state in place of the discussion
    preview until P3.2. Don't use the sample doctor posts.
  - The gold Quiz & Win card uses the current quiz's real data: questions,
    minutes, coins, and the user's best score and rank when signed in.
- **"Watch & Explore"**: the reels, with filter chips by reel category.

Content comes from the existing homepage tables and settings, so the admin
can still edit it. Add a migration and seed data only where v2 needs a field
that doesn't exist yet (for example the journey tiles); edit those fields in
the existing admin content screens.

## U.6. Homepage v2, part 2

- **Launch Your Brand**:
  - the steps;
  - a live product preview card (pack, MOQ buttons, suggested MRP and net
    rate from the real launch products and bulk tiers);
  - "Add to Order" uses the existing Launch cart action.
- **Top Brands**: real product cards with MRP crossed out, the net rate, and
  "Add +" through the existing cart action.
- **Courses**: a course card and a Saatvik Live card from `CourseTeaser` and
  `LiveSession`.
- **Coins strip** (gold).
- **Real Feedback**: a quote card from `Feedback`.
- **Track Order** banner with the stepper.
- **Why Saatvik** grid from `WhyStep`.
- **Final CTA**: "Create Free Profile" opens sign-in.
- **Old sections**:
  - Remove homepage sections that v2 dropped (for example offers, quick
    actions, trust strip): their components, content strings and admin
    sections.
  - Don't drop tables with data. Hide them from the homepage editor and note
    this under "Later".
  - The admin homepage editor (`/admin/content/sections`) lists exactly the
    v2 sections.

## U.7. Top Brands: catalogue, product page and search

- **`/products`** following `portal.html?view=top-brands`:
  - PageHero, then the FilterBar (search, brand, product form) on top of the
    existing filter and URL logic.
  - "Available products" with the "Live stock preview" pill.
  - v2 product cards: pack visual from the product image, a stock pill based
    on real stock, MRP crossed out, the net rate, QuantityStepper starting at
    the product's minimum quantity, and "Add to Order".
  - A floating "Order List" button with the real cart count that opens the
    cart Drawer (or links to `/cart`).
- **`/products/[slug]`** and **`/search`** in the same style.
- Keep the pagination, filters, prices, and the server checks on minimum
  quantity and stock.

## U.8. Launch Your Brand screens

- **`/launch`** following `portal.html?view=launch-brand`:
  - PageHero, then the StepsBar (Choose product / Customise brand / Review &
    submit) and FilterBar;
  - the side filter list (product form, practice area);
  - "Featured formulations" cards with a coloured pack header and "View &
    Customise".
- The customise step uses the live label preview. Keep the existing brand
  profile, label details, logo upload and Launch cart logic. Honour any open
  request in The Den's backlog about which label fields to show, and don't
  re-add fields that were removed.
- **`/my-brand`**, **`/my-brand/[id]`** (stage stepper) and
  **`/account/brands`** in the same style.

## U.9. Cart, checkout, orders and Track Order

- **`/track`** following `portal.html?view=track-order`:
  - PageHero;
  - the tracking card with "Order / Request ID", mobile number and "Track
    Order";
  - "Previous orders" for signed-in users (with "Reorder" only if a reorder
    action exists; otherwise leave it out);
  - the Stepper for the result.
- **`/cart`**, **`/checkout`**, **`/checkout/pay/[orderId]`**,
  **confirmation** and **failed** pages in v2.
- **`/orders`** and **`/orders/[id]`** (timeline, documents).
- No change to totals, coins, address or payment logic.

## U.10. Quiz & Win

**`/quiz`** following `portal.html?view=quiz`:
- PageHero with this week's quiz.
- The challenge card: timer pill, progress bar, question count, options A–D,
  "Next Question", and the result state.
- The dark green leaderboard card with This week / This month PillTabs, from
  the real leaderboard query.

**`/quiz/leaderboard`** in the same style. The quiz rules, timing,
anti-cheat and coin awards stay as they are.

## U.11. Saatvik Coins and My Profile

- **`/coins`** following `portal.html?view=coins`:
  - the dark green wallet card (sign-in prompt, or the real balance);
  - InfoCards for How to earn, How to use, Validity and Clear history, using
    the real rules from settings;
  - the "Coin history" table from the ledger.
- **`/account`** following `portal.html?view=profile`:
  - the profile card with avatar, completion bar and side nav (Overview,
    Orders & Requests, Courses, Saatvik Coins, Saved Products, Professional
    Details), with links only to sections that exist;
  - cards for active requests and the reward wallet, and links to learning
    and community;
  - "Select your main practice interests" only if a field for it exists;
    otherwise note it under "Later".
- **`/account/addresses`**, **`/reports`** and **`/two-factor`** in the same
  layout.

## U.12. New pages: Courses and Dr. Talk

- **`/courses`** following `portal.html?view=courses`:
  - PageHero;
  - PillTabs: Courses, Saatvik Live, and Ebooks & Resources (which links to
    `/ebooks`);
  - topic chips;
  - course cards from `CourseTeaser`;
  - "Upcoming Saatvik Live" from `LiveSession`.
  - Links go where course data points today. No course purchase flow (that's
    P3.1).
- **`/dr-talk`** following `portal.html?view=doctor-talk`:
  - the v2 page shell (PageHero, "Professional conversations" heading, the
    Professional discussion standard note);
  - a Coming next state where the feed goes, until P3.2.
  - Don't add sample posts or a working "Ask a Question".
- Both pages get metadata, content strings, nav and dock active states, and
  Playwright tests.

## U.13. New pages: Real Feedback, Why Saatvik, Partner & Grow

- **`/feedback`**: PageHero, PillTabs (All / Letterheads / Videos / Products
  received) filtering the real `Feedback` rows, and MediaCards opening the
  original image in a Modal. Video entries show "Coming next" until videos
  exist.
- **`/why`**: following `portal.html?view=why`, from `WhyStep` and
  `StatItem`.
- **`/partner`**: three pathway InfoCards and a **Request a callback** form.
  This is the one new feature in the phase, so build it securely:
  - Zod on the server: name, 10-digit Indian mobile, partnership type from a
    fixed list, city, and a message with length limits.
  - A server action with rate limits per IP and per mobile, a honeypot field,
    and the same-origin check.
  - A new `PartnerLead` table (migration), and a dev notification through
    `src/server/notify/`.
  - The success message never reveals whether the number was seen before.
  - An admin list page (`/admin/partner-leads`) behind a new permission, with
    status (new / contacted / closed) and the admin log.
  - Vitest for validation and rate limits; Playwright for the form and the
    admin list.
- Update `docs/PLAN.md` security notes if needed.

## U.14. Remaining site screens

Apply v2 to every other site screen so nothing looks old:
- `/ebooks` and `/ebooks/[slug]`;
- the policy pages (`/privacy`, `/terms`, `/shipping`, `/rewards-policy`);
- `/reset-password` and `/admin-invite/[token]`;
- the maintenance page, `error.tsx`, `global-error.tsx`, not found, the
  coming-soon page and "Report a problem".

Walk through every route under `src/app/(site)` at 375 and 1280 px and list
any you changed or checked in the progress entry.

## U.15. Admin portal v2: shell and shared admin components

There is no admin screen in the mockup, so the admin uses the v2 tokens,
type and components in a calm, dense, desktop-first form that still works at
375 px:
- the admin layout, nav (`admin-nav.tsx`) and header;
- `page-header`, `data-table`, `pagination`, `form-fields`, `badges`,
  `notice`, `row-actions`, `confirm-delete`, the tabs components and the
  stats cards;
- `/admin` (dashboard).

Add an admin section to `/design` and an admin part to DESIGN.md.

## U.16. Admin portal v2: every admin page

Go through every route under `src/app/admin` (users, approvals, catalogue,
orders, brand orders, inventory, coins, content, ebooks, errors, reports,
settings, admins, database, partner leads). Swap leftover one-off styling for
the shared admin components and fix layout at 375 and 1280 px. Leave the
permissions and server actions alone. List every page in the progress entry.

## U.17. UI quality, accessibility and security pass

- Compare every site screen with `docs/mockup-v2/screens/` at 375 and
  1280 px, and fix the differences. Check 360, 414, 768 and 1024 px for
  overflow.
- Search for raw hex or rgb values outside `globals.css`, duplicated markup
  that should be a component, unused components and content strings left
  from the old design, and remove them.
- Check that axe passes on every page, keyboard and focus order work, reduced
  motion is respected, and images have alt text and sizes. Check the
  Lighthouse performance of the homepage on mobile, including the font
  loading strategy.
- Security review of everything changed in the phase, especially U.13's
  form: validation, rate limits, permissions, CSP and no secrets.
- Write a UI phase summary in `docs/PROGRESS.md`. **Do not deploy.**
