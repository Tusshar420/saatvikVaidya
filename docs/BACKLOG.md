# Backlog and ideas

Things we agreed to do later. Not needed for the test address or launch.
Move an item into `docs/CHUNKS.md` when it is picked up.

## UI

- **U.17 UI quality, accessibility and security pass** (see `docs/CHUNKS.md`).
  Owner decision, 2026-10-25: skip for now, finish later. Includes:
  - Compare every site screen with `docs/mockup-v2/screens/` at 375 and
    1280 px; check 360, 414, 768 and 1024 px for overflow.
  - Remove raw hex/rgb values outside `globals.css`, duplicated markup, unused
    components (old offers, quick actions, trust, partner sections) and old
    design strings.
  - Keyboard and focus order, reduced motion, alt text; homepage mobile
    Lighthouse score and font loading.
  - Security review of the UI phase changes.
  - Merge the two `PageHero` components and `brand/launch-hero.tsx`.
- **U.14 leftovers:** reset-password, admin-invite, maintenance and error
  pages are fine but not compared with the mockup.

## Known gaps from earlier entries

- Phone-code (OTP) sign-in, email sending and shipping steps wait for
  MSG91, an email provider and Shiprocket.
- Razorpay, 2 to 3 months after launch.
- Notifications for new courses, Dr. Talk threads, quizzes and brands are not
  created yet; no admin screen to hide threads or replies.
- Homepage text and Why Saatvik steps in the database still hold the old
  wording.

## Courses (after B1 and B2, 2026-10-25)

- Doctors' share of course sales: today staff pay it outside the site. A
  payout report per doctor (sales, GST, share) would help once courses sell.
- Free online courses with enrolment (today a course with no price offers a
  call instead).
- Hosted course content (videos, files, lessons) instead of joining details
  as text; a YouTube player on the course page needs a CSP change.
- Course orders in Admin → Orders look like other store orders; a filter for
  course orders would help staff.
- Saatvik Live sessions are seeded only; no admin screen yet.
