# Team test plan: Saatvik Vaidya test address

A checklist for the team. No technical knowledge is needed. Work through the
tests in order, tick **Pass** or **Fail**, and report every Fail (see
"How to report a problem" below).

Written 25 October 2026 from the site as it is now. Last day to finish
testing and fixes: **31 October**. The site opens to the public on
**1 November**.

---

## Before you start

**The address.** Use only the test address the owner sends you, for example
`https://test.yourdomain.com`. Check the padlock next to the address. Never
test on the main address.

**The team password.** The browser first shows a small box asking for a
user name and password. That is the **team password** from the owner. It
is not your shopping account. You type it once per browser.

**Use email, not mobile, to sign up.** Text-message codes (OTP) and emails
are **not sent yet** on the test address. So:

- Always choose the **Email** tab when you sign up or sign in.
- Use a real-looking email you will remember, for example
  `priya+doctor@gmail.com`. No email arrives, so any address in the right
  format works.
- Write down each email and password you create.

**Everything here is test data.** Accounts and orders are deleted before
1 November. **Never pay real money.** The site shows no payment options for
now; never pay anyone who asks.

**Words used in this plan**

| In this plan | What you pick on the site |
| --- | --- |
| Doctor | "I am a" **Ayurveda Doctor** |
| Regular buyer | "I am a" **Customer** |
| Bulk buyer | "I am a" **Pharmacy / Store** or **Stockist / Distributor** (the site has no button called "bulk buyer") |
| Firm staff | An **admin** account, made for you by the developer. You open it from your account menu, **Admin panel**. |

**Set-up (one staff member does this first, once)**

| No. | What to set up | How | Done |
| --- | --- | --- | --- |
| S1 | Admin accounts for staff | The developer makes the **first** admin account. That admin then opens Admin panel → **Admins** → **Invite an admin**, types the staff member's email and role, and taps **Send invitation**. Emails aren't sent yet, so the page shows an **Invitation link**: tap **Copy link** and send it to the staff member on WhatsApp. It works once, within 72 hours. Each admin needs an **authenticator app** on their phone (Google Authenticator or Microsoft Authenticator). The site asks you to set it up at your first sign-in. | ☐ |
| S2 | Payment details | Admin panel → **Settings** → **Payment details (QR and bank)**. Fill in the name, **UPI ID**, bank name, account number and IFSC code. Save. **Leave empty for now:** the site shows no payment details to customers. | ☐ |
| S3 | Stock | Admin panel → **Inventory**. Make sure at least 3 shop products have stock (10 or more each). | ☐ |
| S4 | A course | Admin panel → **Courses** → **Add a course**. Add one test course called "TEST course" with a price (for example 499) under **Selling online**. | ☐ |
| S5 | A quiz | Admin panel → **Quiz** → **Add quiz**. Title "TEST quiz". Tick **Published**. **Opens** = today, **Closes** = 6 days later. Add **exactly 10 questions** (the site insists on 10), each with 2–4 options and the correct answer ticked. Save. | ☐ |

---

## How to fill in this plan

- Each test has **Steps** (do them in order), an **Expected result** (what
  should happen) and a **Pass / Fail** box.
- **Pass** = what you saw matches the expected result.
- **Fail** = anything else: a different message, an error page, a button that
  does nothing, text cut off, a page you can't scroll, and so on.
- Do sections 1 to 9 on **one phone and one computer** at least. Section 10
  says which other devices and browsers to try.

## How to report a problem

For every Fail, add a row to the team's bug log, `docs/BUG_LOG.md`. It has
the columns to fill in, a guide to describing a problem clearly, and how to
take a screenshot on each phone and computer. In short, give:

1. The **test number** (for example "3.4").
2. The **device and browser** (for example "iPhone 13, Safari").
3. What you expected and **what happened instead**.
4. A **screenshot**.

You can also use **Report a problem** in your account menu (or the speech
bubble button at the side of the page). It sends the page you were on to the
staff's error list.

---

## 1. Getting in

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 1.1 | Team password works | 1) Open the test address. 2) Type the team user name and password. | The Saatvik Vaidya home page opens. The padlock shows next to the address. | ☐ Pass ☐ Fail |
| 1.2 | Wrong team password | 1) Open the test address in a private/incognito window. 2) Type a wrong team password. | The site does not open. The box asks again, or the page says "Private test site. Sign in with the team password." | ☐ Pass ☐ Fail |
| 1.3 | Home page | 1) Scroll the whole home page slowly. | All sections load with pictures and text. Nothing overlaps. You never need to scroll sideways. | ☐ Pass ☐ Fail |
| 1.4 | Menu links | 1) Tap each item in the top menu (computer) or the bottom bar (phone): Home, Dr. Talk, Quiz & Win, Launch Your Brand, Top Brands, Courses, Saatvik Coins, Track Order. | Each one opens its own page with a heading. No error page. | ☐ Pass ☐ Fail |
| 1.5 | Wrong address | 1) Add `/abc-not-real` to the end of the address and open it. | A "We couldn't find that page" screen with **Go to the homepage** and **Browse products** buttons. Both buttons work. | ☐ Pass ☐ Fail |

## 2. Sign up, sign in and sign out

Do 2.1 to 2.3 once each, so you end up with three accounts: a doctor, a
regular buyer and a bulk buyer. Use a different email for each.

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 2.1 | Sign up as a doctor | 1) Tap **My Profile** (computer, top right) or **You** (phone, bottom bar), then **Sign in**. 2) Tap the **Email** tab. 3) Tap **Create an account**. 4) Fill in Full name, Email, a password of 8+ characters. 5) "I am a": **Ayurveda Doctor**. 6) Tick "I agree to the Terms…". 7) Tap **Create account**. | A note says professional prices unlock after the team checks your documents. After **Create account**, the window closes, "Welcome, [your name]" shows, and your name or initials appear at the top. | ☐ Pass ☐ Fail |
| 2.2 | Sign up as a regular buyer | Same as 2.1, but choose **Customer**. | Same as 2.1, but with no note about professional prices. | ☐ Pass ☐ Fail |
| 2.3 | Sign up as a bulk buyer | Same as 2.1, but choose **Pharmacy / Store** (or **Stockist / Distributor**). | Same as 2.1, with the note about professional prices. | ☐ Pass ☐ Fail |
| 2.4 | My account page | 1) While signed in, open your account menu → **My account** (phone: **You**). | Your name, email and account type (for example "Ayurveda Doctor") are shown. | ☐ Pass ☐ Fail |
| 2.5 | Sign out | 1) Open your account menu → **Sign out** (phone: **You** → **Sign out** at the bottom). | "You're signed out." Your name disappears from the top. **My Profile / Sign in** shows again. | ☐ Pass ☐ Fail |
| 2.6 | Sign in again | 1) **Sign in** → **Email** tab. 2) Type the email and password from 2.1. 3) Tap **Sign in**. | You are signed in as the doctor again. | ☐ Pass ☐ Fail |
| 2.7 | Sign in on a second device | 1) On another phone or computer, sign in with the same account. | It works. Both devices stay signed in. | ☐ Pass ☐ Fail |
| 2.8 | Signed-in page while signed out | 1) Sign out. 2) Tap **Order** (phone) or open **My orders**. | You are asked to sign in. After signing in, you land back on that page. | ☐ Pass ☐ Fail |

## 3. Mistakes and empty forms (error handling)

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 3.1 | Wrong password | 1) **Sign in** → **Email**. 2) Your real email, a wrong password. 3) **Sign in**. | Red message: "That email and password don't match. Try again or reset your password." You stay signed out. | ☐ Pass ☐ Fail |
| 3.2 | Email that has no account | 1) Sign in with an email nobody used, any password. | The **same** message as 3.1. It must not say "no account found". | ☐ Pass ☐ Fail |
| 3.3 | Empty sign-in form | 1) **Sign in** → **Email**. 2) Leave both boxes empty. 3) Tap **Sign in**. | "Enter a valid email address." under Email and "Enter your password." under Password. | ☐ Pass ☐ Fail |
| 3.4 | Empty sign-up form | 1) **Create an account**. 2) Fill in nothing. 3) Tap **Create account**. | A red message under each box: name, email, password, "Choose who you are." and "Please accept the terms to continue." | ☐ Pass ☐ Fail |
| 3.5 | Short password | 1) Sign up with a 5-letter password. | "Use at least 8 characters for your password." | ☐ Pass ☐ Fail |
| 3.6 | Common password | 1) Sign up with the password `password123`. | "That password is too common and easy to guess. Choose another one." | ☐ Pass ☐ Fail |
| 3.7 | Email already used | 1) Sign up again with the email from 2.2 and any new password. | The site does **not** say the email is taken (this protects privacy). Your old password still works afterwards. | ☐ Pass ☐ Fail |
| 3.8 | Too many wrong passwords | 1) Type a wrong password 6–10 times in a row. | After a few tries: "Too many attempts. Please wait a few minutes before trying again." | ☐ Pass ☐ Fail |
| 3.9 | Forgot password | 1) **Sign in** → **Email** → **Forgot password?** 2) Type your email. 3) **Send reset link**. | "If an account uses [email], we've sent it a link…". **Known limit:** no email arrives yet on the test address. Mark Pass if the message shows. | ☐ Pass ☐ Fail |
| 3.10 | Empty address form | 1) Signed in, add any product to the cart and tap **Check out**. 2) **Add a new address**. 3) Leave it empty and tap **Save address**. | A red message under each required box (name, mobile number, address, city, state, PIN code). | ☐ Pass ☐ Fail |
| 3.11 | Wrong PIN code | 1) In the address form, choose state **Kerala** and PIN code **110001** (a Delhi PIN). 2) Save. | "This PIN code isn't in the state you chose. Check both." | ☐ Pass ☐ Fail |
| 3.12 | Track order with wrong details | 1) **Track Order**. 2) Type a made-up order number and phone. 3) **View order status**. | "We couldn't find an order with these details…". It must not show anyone's order. | ☐ Pass ☐ Fail |

## 4. Doctor: verification and Dr. Talk

Doctors creating and selling their own courses is in section 5.

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 4.1 | Doctor uploads a certificate | 1) Sign in as the doctor. 2) **My account** → **Your documents**. 3) Upload any small PDF or photo as **Registration certificate**. | "Registration certificate uploaded." Then: "Thanks, your documents are with our team…". | ☐ Pass ☐ Fail |
| 4.2 | Wrong file type | 1) Try to upload a Word file (.docx) or a very large file (over 5 MB). | A clear message saying the file type or size isn't accepted. Nothing is uploaded. | ☐ Pass ☐ Fail |
| 4.3 | Staff approve the doctor | 1) Staff: Admin panel → **Approvals**. 2) Open the doctor. 3) Open the document, then **Approve**. | The doctor leaves the waiting list. | ☐ Pass ☐ Fail |
| 4.4 | Doctor sees approval | 1) Doctor: reload **My account**. 2) Open any product in **Top Brands**. | "Our team has verified your documents. Professional prices are unlocked…". The product shows the professional price. | ☐ Pass ☐ Fail |
| 4.5 | Staff reject with a reason | 1) Use the bulk buyer account to upload documents (Drug licence and GST certificate). 2) Staff: **Approvals** → **Reject** with a reason. 3) Bulk buyer: reload **My account**. | The bulk buyer sees "We couldn't verify your documents…" with the reason, and can upload again. | ☐ Pass ☐ Fail |
| 4.6 | Dr. Talk: start a thread | 1) Approved doctor: **Dr. Talk** → **Start a thread**. 2) Type: Question. Title and Details (10+ characters). 3) **Post thread**. | The thread appears at the top with a "Verified doctor" badge. | ☐ Pass ☐ Fail |
| 4.7 | Dr. Talk: reply and like | 1) Open a thread. 2) Write a reply → **Reply**. 3) Tap the like button. | The reply shows under the thread. The like count goes up by 1. Tap again and it goes back down. | ☐ Pass ☐ Fail |
| 4.8 | Dr. Talk: regular buyer can only read | 1) Sign in as the regular buyer. 2) Open **Dr. Talk**. | Threads can be read. There is no **Start a thread** or reply box. A note says posting is for verified doctors. | ☐ Pass ☐ Fail |
| 4.9 | Dr. Talk: signed out | 1) Sign out. 2) Open **Dr. Talk**. | "Sign in to read Dr. Talk", with a **Sign in** button. | ☐ Pass ☐ Fail |

## 5. Courses

Courses with a price are bought online, like medicines: **Enrol** puts the
course in the cart, and payment is by QR or bank transfer. Courses without a
price show "Enrolment opens soon" with a Call button. Approved doctors make
their own courses under **Teach a course**; staff check each one before it is
listed.

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 5.1 | Browse courses | 1) Open **Courses**. 2) Scroll the course cards. 3) Tap the topic buttons (All topics, Foundation course, …). | Course cards show title, text and details. Courses sold online show their price. The topic buttons filter the cards. | ☐ Pass ☐ Fail |
| 5.2 | Course without a price | 1) Tap **View course** on a course with no price. | "Enrolment opens soon", with a **Call +91 …** button. On a phone, the Call button opens the dialler. | ☐ Pass ☐ Fail |
| 5.3 | Doctor creates a course | 1) Approved doctor (from 4.4): **My account** → **Teach a course**. 2) **Create a course**. 3) Fill in title, topic, format, summary, a price (for example 999) and the joining details (for example a Zoom link). 4) **Send for review**. | "Saved. Our team will check your course before it's listed." The course shows **Waiting for review**. It is **not** on the Courses page yet. | ☐ Pass ☐ Fail |
| 5.4 | Doctor form mistakes | 1) **Create a course**, leave the title empty and type "abc" as the price. 2) **Send for review**. | A red message under the title and under the price. Nothing is saved. | ☐ Pass ☐ Fail |
| 5.5 | Not a doctor | 1) Sign in as the regular buyer (or a doctor not yet approved). 2) Open the address `/doctor/courses`. | "For verified doctors" and a button to My account. No course form. | ☐ Pass ☐ Fail |
| 5.6 | Staff send a course back | 1) Staff: Admin panel → **Courses**. The doctor's course shows "Waiting for review". 2) Open it. 3) In **Review**, type a note and tap **Send back for changes**. 4) Doctor: open **Teach a course**. | The doctor sees **Needs changes** and the staff's note. The doctor also gets a notification (bell). | ☐ Pass ☐ Fail |
| 5.7 | Staff approve a course | 1) Doctor: edit the course and **Send for review** again. 2) Staff: open it and tap **Approve and list**. 3) Open the public **Courses** page. | The course is listed with its price. The doctor gets a notification and sees **Listed**. | ☐ Pass ☐ Fail |
| 5.8 | Buy a course | 1) Regular buyer: open the course from 5.7. 2) Check that the joining details are **not** shown. 3) **Enrol: add to cart**. 4) **Go to cart** → **Check out**, choose an address → **Place order**. | The cart shows the course as "Online course", with no delivery charge. The QR / bank payment screen opens with the course price (section 8). | ☐ Pass ☐ Fail |
| 5.9 | Enrolled after payment | 1) Staff: mark the order paid (8.5). 2) Buyer: open the course page again, and **My account** → **My courses**. | "You're enrolled" and the joining details from 5.3. The course is under **My courses**. The buyer and the doctor both get a notification. The doctor's course shows "1 enrolment". | ☐ Pass ☐ Fail |
| 5.10 | Can't buy twice | 1) Buyer: open the same course again. | No Enrol button; it shows "You're enrolled". | ☐ Pass ☐ Fail |
| 5.11 | Staff add, edit and hide a course | 1) Staff: **Courses** → **Add a course**, fill it in with a price, save. 2) Edit it and change the title. 3) Untick **Show on the site**. | The course shows on the Courses page with the new title, then disappears once hidden. A course someone has paid for can't be deleted; hide it instead. | ☐ Pass ☐ Fail |
| 5.12 | Saatvik Live | 1) On **Courses**, tap **Saatvik Live**. | The page jumps to the list of live sessions (or says there are none). | ☐ Pass ☐ Fail |
| 5.13 | Ebooks | 1) **Courses** → **Ebooks & Resources**. 2) Open a free ebook. | The ebook page opens. A free ebook can be read or downloaded. | ☐ Pass ☐ Fail |

## 6. Medicine shop: browse and order (regular buyer)

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 6.1 | Browse products | 1) Open **Top Brands**. 2) Scroll. 3) Use the filters (brand, type) and sorting. | Product cards with picture, name, brand and price. The filters change the list. | ☐ Pass ☐ Fail |
| 6.2 | Search | 1) Tap the search box or magnifier. 2) Type "ashwagandha" and press Enter. | A list of matching products. A word that matches nothing shows a friendly "no results" message. | ☐ Pass ☐ Fail |
| 6.3 | Product page | 1) Open any product. | Pictures, price (with the discount and old price struck through, if any), pack size, description and **Add to cart**. | ☐ Pass ☐ Fail |
| 6.4 | Add to cart | 1) **Add to cart** on 2 different products. 2) Tap the bag icon at the top. | The bag shows a count. The cart lists both products with the right prices and a total. | ☐ Pass ☐ Fail |
| 6.5 | Change the cart | 1) In the cart, raise one quantity, lower it, then remove one product. | The total updates each time. The removed product disappears. | ☐ Pass ☐ Fail |
| 6.6 | Cart when signed out | 1) Signed out, add a product. 2) Open the cart. | The button says **Sign in to check out**. After signing in, the product is still in the cart. | ☐ Pass ☐ Fail |
| 6.7 | Add an address | 1) **Check out**. 2) **Add a new address**. 3) Fill it in correctly. 4) **Save address**. | "Address saved". It is chosen for delivery. | ☐ Pass ☐ Fail |
| 6.8 | Place an order | 1) Check the order summary. 2) Tap **Place order**. | A note above the button says you'll see the QR code and bank details next. After tapping, the payment screen opens (section 8). | ☐ Pass ☐ Fail |
| 6.9 | My orders | 1) Account menu → **My orders** (phone: **Order**). | The new order is at the top, with its number, date, total and status "waiting for payment" (or similar). | ☐ Pass ☐ Fail |
| 6.10 | Saatvik Coins page | 1) Open **Saatvik Coins**. | The rules for earning and using coins, and your balance once signed in. | ☐ Pass ☐ Fail |

## 7. Bulk branded order: Launch Your Brand (bulk buyer)

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 7.1 | Open Launch Your Brand | 1) Sign in as the bulk buyer. 2) Open **Launch Your Brand**. | Step bar: **Products → Launch cart → Packaging → Review and pay**. A list of products for private label, each with a minimum order and price. | ☐ Pass ☐ Fail |
| 7.2 | Signed out | 1) Signed out, open **Launch Your Brand** and try to go past step 1. | You are asked to sign in. | ☐ Pass ☐ Fail |
| 7.3 | Choose products | 1) Add 2 products to the launch cart. 2) Go to **Launch cart**. | Both products, each starting at its minimum quantity. | ☐ Pass ☐ Fail |
| 7.4 | Quantities in steps | 1) Change a quantity to a number that is **not** a multiple of the minimum (for example 130 if the minimum is 100). | The quantity snaps to a correct step, with a message such as "Quantities go in steps of 100, so this is now 100." Bulk prices change as quantity grows. | ☐ Pass ☐ Fail |
| 7.5 | Packaging: brand and logo | 1) Go to **Packaging**. 2) Add a new brand (brand name, tagline, Marketed By details). 3) **Upload logo** (a PNG or JPG). | "Logo uploaded" and a preview of the logo. | ☐ Pass ☐ Fail |
| 7.6 | Packaging: no logo | 1) Try to continue with a brand that has no logo. | "Add a logo to this brand before you continue." | ☐ Pass ☐ Fail |
| 7.7 | Labels | 1) Fill in the label details for each product. 2) Make one field very long. | The too-long field is highlighted: "Some labels are too long for their pack…". | ☐ Pass ☐ Fail |
| 7.8 | Review and place | 1) **Review and pay**: check products, quantities, brand and logo. 2) Choose a delivery address. 3) **Place order**. | The QR / bank payment screen opens (section 8) with this order's total. | ☐ Pass ☐ Fail |
| 7.9 | Find your branded orders | 1) Leave the payment screen and go to the home page. 2) Computer: account menu → **My brand orders**. Phone: **You** → **Branded orders**. | The branded order is listed with its status. Tapping it opens the order. (Branded orders are not in **My orders**.) | ☐ Pass ☐ Fail |
| 7.10 | Staff see the brand order | 1) Staff: Admin panel → **Brand orders**. 2) Open the order. | Customer name, account type, logo (downloadable), labels as ordered, products and quantities. | ☐ Pass ☐ Fail |
| 7.11 | Label proof | 1) Staff mark the order paid (8.5 works the same here). 2) Upload any PDF or image as a proof → **Send proof**. 3) Bulk buyer: open the order from **My brand orders**. | "Label proof", Version 1, "Waiting for you", with **Approve this proof** and **Ask for changes**. | ☐ Pass ☐ Fail |
| 7.12 | Ask for changes, then approve | 1) Bulk buyer: **Ask for changes**, type a comment → **Send changes**. 2) Staff: send Version 2. 3) Bulk buyer: **Approve this proof**. | Staff see the comment. After approval: "Proof approved. We'll start printing soon." | ☐ Pass ☐ Fail |
| 7.13 | Production steps | 1) Staff: use **Update status to …** to move the order through In production → Quality check → Dispatched → Delivered. 2) Bulk buyer: reload the order after each step. | The buyer sees each new status. | ☐ Pass ☐ Fail |

## 8. Order received and staff order handling

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 8.1 | Order received screen | After 6.8 (or 7.8), look at the screen that opens. | Heading "Your order is received" and "Thank you. We have your order." The order number and **Order total** match the order. | ☐ Pass ☐ Fail |
| 8.2 | No payment options | Look for any QR code, UPI ID, bank details or pay button. | None. The text says the team will call to confirm the order and share how to pay. | ☐ Pass ☐ Fail |
| 8.3 | Screen on a phone | Open the same screen on a phone. | Everything is readable without zooming and nothing runs off the side. | ☐ Pass ☐ Fail |
| 8.4 | Staff see the order | Staff: Admin panel → **Orders**. | The order shows as Waiting for payment, with the buyer's phone number and address, so the team can call. | ☐ Pass ☐ Fail |
| 8.5 | Staff mark the order paid | 1) Staff: Admin panel → **Orders**. 2) Open the order. 3) Box "Waiting for payment" → **Mark as paid** (after the team has agreed payment with the buyer). | "Marked as paid. The invoice and confirmation are on their way." The status becomes Paid. | ☐ Pass ☐ Fail |
| 8.6 | Buyer sees it paid | 1) Buyer: reload **My orders** and open the order. | Status Paid. A GST invoice can be downloaded (PDF opens). | ☐ Pass ☐ Fail |
| 8.7 | Staff find orders | 1) Staff: **Orders**. 2) Search by order number, then filter by status. | The right orders show each time. | ☐ Pass ☐ Fail |
| 8.8 | Staff cancel an order | 1) Place a second small order as the buyer. 2) Staff: open it and cancel it. | Status Cancelled for staff and for the buyer. The stock goes back (check **Inventory**). | ☐ Pass ☐ Fail |
| 8.9 | Shipping | 1) Staff: open a paid order and look at **Shipment**. | **Known limit:** "Create shipment" is switched off on the test address until the courier service is connected. Mark Pass if it is clearly shown as off and nothing breaks. | ☐ Pass ☐ Fail |
| 8.10 | Staff dashboard and reports | 1) Staff: open **Dashboard** and **Reports**. | Numbers and lists load with no error, and include the test orders. | ☐ Pass ☐ Fail |

## 9. Quiz & Win

Needs the quiz from set-up step S5.

| No. | Test | Steps | Expected result | Pass / Fail |
| --- | --- | --- | --- | --- |
| 9.1 | Quiz shows on the site | 1) Open **Quiz & Win**. 2) Also look at the quiz part of the home page. | "This week: TEST quiz", "10 questions · 5 minutes", the rules and when it closes. | ☐ Pass ☐ Fail |
| 9.2 | Signed out | 1) Signed out, open **Quiz & Win**. | **Sign in to play** instead of **Start quiz**. The questions are not shown. | ☐ Pass ☐ Fail |
| 9.3 | Play the quiz | 1) Sign in (any account). 2) **Start quiz**. 3) Answer each question. 4) **Submit answers**. | A timer counts down from 5:00. "x of 10 answered" goes up. After submitting: your points, number correct, time taken, and each answer with its explanation. | ☐ Pass ☐ Fail |
| 9.4 | Coins for a good score | 1) Score at or above the pass mark. | "You earned … Saatvik Coins." The coins show on the **Saatvik Coins** page. A low score shows "Score …% or more to earn coins." | ☐ Pass ☐ Fail |
| 9.5 | Only one try | 1) Open **Quiz & Win** again with the same account. | Your result shows. You can't start the quiz again. | ☐ Pass ☐ Fail |
| 9.6 | Refresh during the quiz | 1) With another account, start the quiz and answer 3 questions. 2) Refresh the page. | Your 3 answers are still chosen. The timer keeps counting (it does not restart at 5:00). | ☐ Pass ☐ Fail |
| 9.7 | Empty answers | 1) Start, answer only 2 questions, tap **Submit answers**. | A warning: "8 questions are not answered yet." You can still submit. | ☐ Pass ☐ Fail |
| 9.8 | Time runs out | 1) Start the quiz and wait 5 minutes without submitting. | "Time is up. Your answers are being scored." A result shows. | ☐ Pass ☐ Fail |
| 9.9 | Leaderboard | 1) **See the leaderboard**. 2) Switch **This week** / **This month**. | Players ranked by points, then time. Only first name and last initial. "Your rank" shows for you. | ☐ Pass ☐ Fail |
| 9.10 | Staff edit a played quiz | 1) Staff: **Quiz** → open TEST quiz. | A note says people have played it, so its questions can't be changed. The dates and pass mark can still be changed. | ☐ Pass ☐ Fail |
| 9.11 | Staff: quiz form mistakes | 1) Staff: **Add quiz**, set opening and closing dates, add only 3 questions, save. | "A scheduled quiz needs exactly 10 questions." Nothing is saved. | ☐ Pass ☐ Fail |

---

## 10. Phones, tablets, computers and browsers

**How:** each tester takes one row of the device table and runs these
**quick checks** on it: 1.1, 1.3, 1.4, 2.6, 2.5, 3.1, 5.8, 6.1, 6.3, 6.4,
6.8, 8.1, 8.4 (phones only), 9.3 and 4.6 (doctor) or 7.1 (bulk buyer).

On every device, also check:

- You never need to scroll sideways, and nothing is cut off at the right edge.
- Text is readable without zooming.
- Buttons are easy to tap with a finger.
- Pop-ups (sign-in, search) open fully and close with the X.
- Turn the phone or tablet sideways once: the page still looks right.

### Devices

| No. | Device type | Example | Screen | Tester | Pass / Fail |
| --- | --- | --- | --- | --- | --- |
| 10.1 | Small phone | iPhone SE, or a small Android (about 5 inches) | about 360–375 px wide | | ☐ Pass ☐ Fail |
| 10.2 | Large phone | iPhone 14/15 Pro Max, Samsung Galaxy S or A series (6.5 inches or more) | about 400–430 px wide | | ☐ Pass ☐ Fail |
| 10.3 | Tablet | iPad or an Android tablet, upright **and** sideways | about 768–1024 px wide | | ☐ Pass ☐ Fail |
| 10.4 | Laptop | Any laptop (13–15 inch screen) | about 1280–1440 px wide | | ☐ Pass ☐ Fail |
| 10.5 | Large monitor (optional) | Desktop monitor, 24 inch | 1920 px wide | | ☐ Pass ☐ Fail |

### Browsers

| No. | Browser | Where to test | Tester | Pass / Fail |
| --- | --- | --- | --- | --- |
| 10.6 | Chrome | Android phone **and** a Windows or Mac computer | | ☐ Pass ☐ Fail |
| 10.7 | Safari | iPhone **and** a Mac (or iPad) | | ☐ Pass ☐ Fail |
| 10.8 | Firefox | Windows or Mac computer | | ☐ Pass ☐ Fail |
| 10.9 | Samsung Internet (optional) | Samsung phone | | ☐ Pass ☐ Fail |

---

## Known limits on the test address (not Fails)

- **Mobile number sign-in (OTP)** doesn't work yet: no text messages are
  sent. Use email.
- **No emails** are sent: forgot password and order confirmations. Admin
  invitations show a link on screen to send by hand (S1). If you are locked
  out, staff can make you a new account (Admin panel → **Users** → **Add a
  user**, with a password you choose).
- **Online card/UPI gateway (Razorpay)** comes 2–3 months after launch.
  Payment is by QR or bank transfer, and staff mark orders paid.
- **Courier booking and live tracking** wait for the courier service.
- **Paying doctors their share** of course sales is done by staff outside
  the site, by bank transfer.

## After testing

- The developer clears all test accounts and orders before 1 November
  (`docs/LAUNCH_1_NOVEMBER.md`, section 3). Staff admin accounts are kept and
  removed by hand if they were only for testing.
- Every Fail must be fixed and **tested again** with the same test number
  before launch.

## Sign-off

| Tester | Devices and browsers | Date | Tests failed (numbers) | Signature |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |
| | | | | |

---

## Local run by QA: 25 October 2026

The plan was run on the developer's computer (production build, test
database, QR / bank-transfer payment on), by the automatic browser tests at
phone (375 px) and computer (1280 px) size plus a hands-on check of the main
jobs. It was **not** run on the Hostinger test address, so the team still
does that. "Not tested" means a local run cannot show it.

| Section | Result | How it was checked |
| --- | --- | --- |
| 1 Getting in | **Pass**, except 1.1 and 1.2 padlock: **Not tested** | Home, menu, 404 page: browser tests. Team password lock: unit tests (`src/proxy.test.ts`); the real padlock and password box need the test address. |
| 2 Sign up and sign in | **Pass**, except 2.7 (second device): **Not tested** | `auth`, `sign-in`, `account` browser tests, all three account types. |
| 3 Mistakes and empty forms | **Pass** (3.9 is a known limit) | `auth`, `sign-in`, `checkout`, `orders` tests. |
| 4 Doctor and Dr. Talk | **Pass** | `verification` and `threads` tests: upload, approve, reject, post, reply, like, read-only buyer, signed out. |
| 5 Courses | **Pass** | `courses` test: doctor creates, staff approve, buyer pays by QR, enrolled. 5.13 ebooks: `ebooks` test. |
| 6 Medicine shop | **Pass** | `catalogue`, `checkout`, `orders` tests. |
| 7 Bulk branded order | **Pass** | `brand`, `brand-proof` tests. |
| 8 QR payment and staff orders | **Pass**, except 8.3 (scan with a real UPI app): **Not tested** | `manual-payment` test: QR, UPI ID, bank, account, IFSC, note, Mark as paid. 8.9 shipping is a known limit. |
| 9 Quiz & Win | **Pass** | `quiz` tests: play, coins once, refresh, time out, leaderboard, staff form. |
| 10 Devices and browsers | Phone and computer sizes **Pass**; real devices, Safari, Firefox: **Not tested** | Chrome only, widths 360, 375, 390, 414, 768, 1280 px: no sideways scroll, no console errors, no accessibility errors. |

Problems found: BUG-008 had not really been fixed (see `docs/BUG_LOG.md`);
fixed and passes. Nothing else failed.
