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

## Parked (not queued; to be done later)

- **Razorpay payments:** a `razorpay` implementation of `PaymentProvider`
  (orders API, checkout script, signature check, webhooks, refunds), plus the
  CSP and Permissions-Policy changes it needs. Replaces the test payment in
  production.
- **Shiprocket delivery:** a `shiprocket` implementation of `ShippingProvider`
  (create shipment, AWB, pickup, tracking webhooks). Replaces test shipping in
  production.
- Real SMS (MSG91), email (Resend/Hostinger mail) and file storage (R2).

---

# Phase 2 chunks

Run after P1.12. Same rules as Phase 1: no real integrations (test payment,
dev notifier, local storage), every chunk meets the definition of done.

## P2.1. Launch Your Brand: request and admin review

Private-label requests, from the mockup's "Launch Studio" and "Launch Your
Brand" section ("Select a formulation, explore label directions and submit one
complete request").

- **Catalogue flags:** `Product.privateLabel` (on/off) and a private-label MOQ,
  editable in `/admin/catalogue`. The Launch catalogue card and form tabs list
  only these products.
- **Launch Studio `/launch`** (sign-in required), 4 steps with the Stepper,
  saved as a draft between steps:
  1. Formulation: search, form tabs (Vati, Churna, Guggulu, Asava, ...),
     suggested MRP.
  2. Quantity and pack: at least the MOQ, pack size.
  3. Brand and label: brand name, label direction choices, optional logo
     upload (through `Storage`), notes.
  4. Review and submit.
- **Models:** `BrandRequest` (user, product, quantity, pack, brand name, label
  choices, logo, notes, status, timestamps) and `BrandRequestEvent` (status
  history with who and a note).
  - Statuses: `draft`, `submitted`, `under_review`, `quoted`,
    `quote_accepted`, `quote_declined`, `proof_sent`, `changes_requested`,
    `proof_approved`, `in_production`, `quality_check`, `dispatched`,
    `delivered`, `cancelled`.
  - The server enforces which status can follow which.
- **Customer "My Brand" `/my-brand`:** list and detail with the status
  timeline. The mobile dock's Cart item becomes **My Brand** (DESIGN.md), and
  the cart stays reachable from the header.
- **Admin `/admin/brand-requests`:** list with filters, detail showing the
  requester's user type and verification status, move to `under_review`,
  cancel with a reason.
- Hero Launch Studio buttons, "Start a private-label request" and "Launch
  Your Brand" links now go to `/launch`.
- **Notifications (dev log):** to the admin on submit, and to the user on
  every status change.
- **Tests:**
  - Vitest for status transitions and MOQ rules.
  - Playwright for the full 4-step request on phone and desktop, and the
    admin review.

## P2.2. Launch Your Brand: quote, label proof and production

- **Quotes:**
  - The admin writes a quote: unit price, quantity, label/setup charges, GST,
    and a validity date.
  - The user accepts or declines it on `/my-brand/[id]`.
  - An expired quote can't be accepted.
- **Advance payment:** accepting the quote goes through the P1.4
  `PaymentProvider` (test provider: simulate success/failure). Only a paid
  quote moves on.
- **Label proofs:**
  - The admin uploads a proof (PDF/image through `Storage`).
  - The user approves it or requests changes with a comment.
  - Every version is kept.
- **Production tracking:**
  - The admin moves the request through In production, Quality check,
    Dispatched (using the P1.5 test `ShippingProvider`) and Delivered.
  - The user sees the mockup's stepper (Confirmed, Production, Quality check,
    Dispatch).
- **Documents:** an invoice for the advance (P1.6), and the approved proof
  stays downloadable by the owner and admins only.
- **Tests:**
  - Playwright for quote, then pay (success and failure), then proof, then
    changes, then approval, then production, then delivered.
  - Vitest for quote expiry and payment idempotency.

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
  - Request/quote ownership checks.
  - Status-transition tampering.
  - Proof and logo upload handling.
  - Quiz answer leakage and timer bypass.
  - Coin double-credit.
- Write a Phase 2 summary in `docs/PROGRESS.md`. **Do not deploy.**
