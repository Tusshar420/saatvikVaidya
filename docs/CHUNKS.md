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
  - One product per brand order.
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

