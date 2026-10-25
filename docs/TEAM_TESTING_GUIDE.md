# Team testing guide: Saatvik Vaidya

Welcome! This guide is for the Saatvik Vaidya team. It tells you how to help
us test the new website before it opens to everyone.

You do not need to know anything technical. If you can use a phone and
WhatsApp, you can do this.

Written 25 October 2026.

---

## The short version

1. Open the **test address**. Type the **team password**.
2. Make a test account. Try the things people will do on the real site.
3. If something looks wrong, write it in the **bug list** (`docs/BUG_LOG.md`).
4. Finish by **31 October**. The real site opens on **1 November**.

---

## 1. What is the test address?

The test address is a **copy of the new website**. We built it so we can try
everything before real customers see it.

- It looks and works like the real site.
- It is **private**. Only our team can open it.
- It is **not** the main address. The main address still shows "Coming soon"
  until 1 November.

**Test address:** `[PUT THE TEST ADDRESS HERE, for example https://test.yourdomain.com]`

Look for the small **padlock** next to the address. It means the page is safe.

---

## 2. Everything here is only for testing

Please remember:

- **Accounts you make here are test accounts.**
- **Orders you place here are test orders.**
- We will **delete all of them** before the site opens on 1 November.
- **Never pay real money.** When you see a QR code, look at it. Check the
  name and the amount. **Do not pay.**
- Don't use someone's real private details. Use made-up names and addresses.
- Don't share the test address or the team password with anyone outside
  the team.

---

## 3. How to open the test address and sign in

### Step 1: Open the address

1. Open your phone or computer browser (Chrome or Safari is fine).
2. Type the test address in the top bar.
3. A small box pops up. It asks for a **user name** and a **password**.

### Step 2: Type the team password

This is the same for the whole team. It is **not** your own account.

- **User name:** `[PUT THE TEAM USER NAME HERE]`
- **Password:** `[PUT THE TEAM PASSWORD HERE]`

The home page opens. You only need to do this once on each browser.

If the box keeps asking, check for spelling mistakes and capital letters.
If it still does not work, message the owner.

### Step 3: Make your own test account

The team password only lets you into the site. To try shopping, courses or
quizzes, you also need a test account.

1. Tap **My Profile** (computer, top right) or **You** (phone, bottom bar).
2. Tap **Sign in**.
3. Tap the **Email** tab. (Please don't use the mobile number tab. Text
   messages are not working on the test address yet.)
4. Tap **Create an account**.
5. Fill in your name, an email, and a password with 8 or more letters and
   numbers.
6. Choose who you are (see the next part).
7. Tick the box to agree. Tap **Create account**.

**Tip:** No email is sent on the test address. So any email that looks right
works, like `priya+doctor@gmail.com`. **Write down every email and password
you make.** You will need them again.

**Test password for accounts we make for you:** `[PUT THE TEST ACCOUNT PASSWORD HERE]`

---

## 4. What to try for each type of person

The site has three kinds of customers, plus the firm's own staff. Try the one
you are given. If you have time, try the others too.

For the full step-by-step checklist, open `docs/TEST_PLAN.md`. Tick Pass or
Fail for each test there.

### Doctor

When you sign up, choose **Ayurveda Doctor** under "I am a".

Try these:

- Sign up, sign out, and sign in again.
- Upload a certificate. Use any small PDF or photo. (Go to **My account**,
  then **Your documents**.)
- Wait for staff to approve you. Then check that doctor prices show.
- Open **Dr. Talk**. Start a thread and reply to another one.
- Open **Courses**. Look at the courses and read the details.
- Make your own course: **My account**, then **Teach a course**, then
  **Create a course**. Give it a price and a joining link. Staff check it
  before it shows on the Courses page.

### Regular buyer

When you sign up, choose **Customer** under "I am a".

Try these:

- Open **Top Brands**. Look at the medicines. Use search.
- Add two or three medicines to your cart. Change how many you want. Remove one.
- Tap **Check out**. Add a test address.
- Place the order.
- Look at the payment page. Check the **QR code** and the payment details.
  They should show the right name and the right amount. **Do not pay.**
- Open **Track Order** and look up the order you just placed.
- Buy a course: open a course with a price, tap **Enrol**, then check out.
  Once staff mark it paid, the course page shows how to join.

### Bulk buyer

When you sign up, choose **Pharmacy / Store** or **Stockist / Distributor**
under "I am a". (The site has no button that says "bulk buyer".)

Try these:

- Upload your documents. Staff will approve or reject them.
- Open **Launch Your Brand**.
- Pick medicines and a number to order. Add your own brand name.
- Send the request. Then check the order and the payment details.
- Check that the prices and the numbers add up.

### Firm staff

Staff use an **admin account**. The developer makes the first one; that
person can then invite the rest of the staff.

Try these:

- Sign in. Open **Admin panel** from your account menu.
- Check **Approvals**. Approve one document and reject one with a reason.
- Open the **orders**. Open a test order. Mark it as paid.
- Add a **course**. Check that it shows on the **Courses** page.
- Check a doctor's course: open **Courses** in the admin panel, open the
  course that is "Waiting for review", then approve it or send it back with
  a note.
- Invite another staff member: **Admins**, then **Invite an admin**. Copy the
  link the page shows and send it on WhatsApp.
- Make a **quiz** with exactly 10 questions. Then see the results.
- Check the payment details in **Settings**.

Your first sign-in asks you to set up an **authenticator app** on your phone.
Follow the steps on the screen.

### Quiz & Win (everyone)

- Open **Quiz & Win** from the menu.
- Answer the quiz. Look at your score.
- Check that the page makes sense on a phone.

---

## 5. Things to check on every page

While you test, keep an eye out for:

- A page that **will not open**, or shows an error.
- A button that **does nothing**.
- Words that are **cut off**, or sit on top of each other.
- A page you have to **scroll sideways** to read.
- A **wrong price**, or numbers that don't add up.
- A **spelling mistake** or a message that is hard to understand.
- Something that works on the computer but **not on the phone** (or the other
  way round).

Many of our customers will use a phone. Please test on a phone as much as you
can.

---

## 6. How to report a problem

Found something wrong? Please tell us. Every problem you find is one less
problem for our customers.

1. Open `docs/BUG_LOG.md`.
2. Go to the table at the bottom. Add a new row with the next number
   (BUG-008, BUG-009, and so on).
3. Fill in the boxes:
   - **Page:** the page name and its address. You can copy the address from
     the top bar.
   - **What happened:** what you thought would happen, and what you saw
     instead.
   - **Steps:** the steps you took, so someone else can see it too.
   - **Device and browser:** for example "iPhone 13, Safari".
   - **Severity:** how bad it is (see below).
   - **Screenshot:** the name of your screenshot.
4. Leave **Status** as **Open**.
5. Take a **screenshot** of the problem and keep it.

### How bad is it?

- **High:** you can't finish an important job. For example, you can't sign
  in, can't place an order, or the price or payment details are wrong. **Tell
  the developer the same day.**
- **Medium:** the job works, but it is hard or confusing. For example, a
  button is hidden on a phone.
- **Low:** it looks a bit wrong, but you can still do your job. For example,
  a spelling mistake.

### What happens next

- The developer fixes the problem and changes the status to **Fixed**.
- Then **you try the same steps again**, on the same device.
- If it works now, change the status to **Re-checked**.
- If it still doesn't work, change it back to **Open** and add a note.

Please don't delete rows. Only change the status.

You can also use **Report a problem** in your account menu. It sends the page
you were on to the staff.

---

## 7. Known limits (not problems)

Some things don't work on the test address yet. Please don't report these:

- **Mobile number sign-in** doesn't work yet. Use email.
- **No emails or text messages** are sent. This includes "forgot password" and
  order emails.
- **Card and online payments (Razorpay)** come 2 to 3 months after launch.
  For now, people pay by QR code or bank transfer.
- **Courier booking and live tracking** are not ready yet.
- **Paying doctors their share** of course sales is done by staff outside
  the site.

If you are locked out of your account, ask the developer. They can make you a
new one.

---

## 8. Testing dates

| Date | What to do |
| --- | --- |
| **Sun 25 Oct** | The test address is ready. The owner shares the address and the team password. |
| **Mon 26 to Tue 27 Oct** | Everyone makes test accounts. Try signing up, signing in, the shop and orders. |
| **Wed 28 Oct** | Try doctor jobs, courses, Launch Your Brand, and the quiz. Staff try the admin panel. |
| **Thu 29 Oct** | Test on different phones and browsers. Keep adding problems to the bug list. |
| **Fri 30 Oct** | The developer fixes problems. You try the same steps again and mark them **Re-checked**. |
| **Sat 31 Oct** | **Last day.** Final check. Every row in the bug list must be **Re-checked**. Sign off in `docs/TEST_PLAN.md`. |
| **Sun 1 Nov** | **The site opens to everyone.** Before this, the developer clears all test accounts and test orders. |

The dates for Monday to Friday are our plan. If we need more time, the owner
will tell you.

**Reminder:** The latest the site can open is **Friday 6 November**. We would
rather open a few days late than open a site with problems.

---

## 9. Who to ask

- **The owner:** `[NAME AND PHONE NUMBER]`. Ask about the team password or
  anything about the plan.
- **The developer:** `[NAME AND PHONE NUMBER]`. Ask about errors, or if you are
  locked out. Tell them the same day if you find a **High** problem.

Thank you for helping. Your careful testing makes the launch better for
everyone.
