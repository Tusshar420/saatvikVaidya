# Text changes (content review)

Only wording changed. No layout, feature or setting was touched. All text lives
in `src/content/`. The Coming soon page (`coming-soon/index.html`) was read
and needed no change.

Razorpay and card payments are not mentioned anywhere as available. The
payment screen on the test address is the QR and bank transfer one.

## QR payment screen (`checkout.ts`)

| Where | Before | After |
|---|---|---|
| Intro line | Pay the amount below using the QR code or the bank details. Your order goes ahead as soon as we see the payment. | Your order is saved, but it is not confirmed until we receive your payment. Pay the exact amount shown, either by scanning the QR code or by bank transfer. |
| Order number note | Write this order number in the payment note | Add this order number to the payment note |
| Heading after the details | What happens next | After you pay |
| Text after the details | We check the payment and mark your order paid, usually within a few working hours. You'll get a confirmation and can follow it on your orders page. | You don't need to do anything else on this page. Our team checks payments by hand, usually within a few working hours. Once yours is found, your order shows as Confirmed under My orders. Still waiting after a day? Please call us. |

Why: the old text promised a "confirmation" that the site does not send for
manual payments, and did not say what the buyer should do next.

## Payment not available (`checkout.ts`)

| Where | Before | After |
|---|---|---|
| Title | Online payment is coming soon | We can't take this order online yet |
| Line | You can't pay online yet. To place this order, call {phone} and our team will take it from there. | Please call {phone} and our team will place the order with you. |
| Error | Online payment is not available right now. | We can't take payment for this order right now. Please call us. |
| Test screen heading | Test payment - no money is taken | Test payment: no money is taken |
| Test screen line | Online payment isn't connected yet. Choose what should happen to see how the order continues. | This is a practice payment screen for testing. Choose what should happen to see how the order continues. |

## Orders (`orders.ts`, `invoices.ts`)

| Where | Before | After |
|---|---|---|
| Payment line on an order | `manual · attempt 1` | `QR or bank transfer · attempt 1` |
| Tracking text, cancelled order | Anything paid for it is refunded to the original payment method. | If you had already paid, our team will contact you about your refund. |
| Cancellation email | Anything you paid is refunded to the original payment method. | You had already paid, so our team will contact you about your refund. |
| Cancellation email | Questions? Reply to this message or call us. | Questions? Please call us and we will help. |
| Credit note note | a credit note reverses the invoice | this credit note cancels the invoice |

Why: payment is by QR or bank transfer, so there is no "original payment
method" to refund to, and the dev messages cannot be replied to.

## Spelling and naming

| Where | Before | After |
|---|---|---|
| Footer link, Reels page title and heading (`shell.ts`, `portal-pages.ts`) | Satvik Reels | Saatvik Reels |
| Account page note (`account.ts`) | Progressive onboarding | Start simple |

## Homepage Dr. Talk card (`home.ts`)

| Before | After |
|---|---|
| Coming next | For doctors |
| Doctor discussions open soon | Join the conversation |
| Verified Doctors will be able to ask questions and discuss de-identified cases here. | Verified Doctors can ask questions and discuss de-identified cases. Signed-in members can read along. |

Why: Dr. Talk threads are already live, so "open soon" was out of date.

## Left alone, for the owner to decide

- Header says "Bag" while pages say "cart" and the dock says "Order". Changing
  it touches navigation labels, so it was not done.
- Admin screens and the `/design` page use internal wording and were not
  edited.
- `portal-pages.ts` still holds unused "Discussions open soon" text
  (`feedSoon*`). Nothing shows it. Remove it later.
- The firm's UPI ID and bank details are still empty in settings. Until they
  are filled in `/admin/settings`, the buyer sees "Our payment details are not
  set up yet" with the phone number.
