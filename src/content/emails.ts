// The frame around every email (src/server/notify/email.ts) and the parts
// order emails share: the order summary, the progress tracker and the
// payment details. Each email's own wording lives with its area (checkout,
// orders, brand, courses...). Keep user-facing text here so Hindi can be
// added later.

const count = (n: number) => n.toLocaleString("en-IN");

export const emails = {
  layout: {
    logoAlt: "Saatvik Vaidya",
    greeting: (name: string) => (name.trim() ? `Namaste ${name.trim()},` : "Namaste,"),
    signOff: "Warm regards,",
    team: "Team Saatvik Vaidya",
    tagline: "Hamara Ayurved, hamara garv",
    help: (phone: string) => `Questions? Call us on ${phone}.`,
    /** Shown under order emails, which buyers can turn off. */
    orderReason: "You're getting this email about an order on your Saatvik Vaidya account.",
    manage: "Change email settings",
    staffReason: "You're getting this email because you are on the Saatvik Vaidya team.",
    accountReason: "You're getting this email because of your Saatvik Vaidya account.",
  },

  /** The order summary shared by order emails. */
  order: {
    summary: "Order summary",
    details: "Order details",
    number: "Order number",
    placedOn: "Placed on",
    customer: "Customer",
    phone: "Phone",
    email: "Email",
    deliverTo: "Delivering to",
    payment: "Payment",
    brand: "Brand",
    courier: "Courier",
    tracking: "Tracking number",
    quantity: (n: number) => `Qty ${count(n)}`,
    /** Brand order lines: "50 jars". */
    units: (n: number, unit: string | null) => (unit ? `${count(n)} ${unit}` : `Qty ${count(n)}`),
    subtotal: "Items total",
    coins: (coins: number) => `Super Coins used (${count(coins)})`,
    delivery: "Delivery",
    free: "Free",
    total: "Order total",
    totalPaid: "Total paid",
    gst: "Prices include GST.",
    viewOrder: "View your order",
    trackOrder: "Track your order",
    openAdmin: "Open the order",
  },

  /** The progress tracker at the top of order emails. */
  steps: {
    store: ["Ordered", "Confirmed", "Shipped", "Out for delivery", "Delivered"],
    brand: ["Ordered", "Paid", "Label proof", "Production", "Dispatched", "Delivered"],
  },

  /** How to pay, in the "order placed" emails. */
  payment: {
    manual: {
      method: "QR code or bank transfer",
      title: "Pay to confirm your order",
      line: (amount: string) =>
        `Your order is saved, but it is confirmed only after we receive your payment. Please pay ${amount}, either by scanning the QR code with any UPI app or by bank transfer.`,
      scan: "Scan with any UPI app (Google Pay, PhonePe, Paytm and more)",
      qrAlt: (amount: string) => `UPI QR code for ${amount}`,
      upiId: "UPI ID",
      payee: "Name",
      bankName: "Bank",
      accountNumber: "Account number",
      ifsc: "IFSC code",
      amount: "Amount",
      reference: (number: string) => `Please write ${number} in the payment note so we can match your payment.`,
      after:
        "After you pay, there's nothing else to do. Our team checks payments by hand, usually within a few working hours, and we'll email you as soon as your order is confirmed.",
      notReady: (phone: string) =>
        `Our payment details are not set up yet. Please call ${phone} and we will share them.`,
      payNow: "See payment details",
    },
    request: {
      method: "Our team will call you",
      title: "What happens next",
      line: "You don't need to pay anything on the website. Our team will call you soon on your delivery phone number to confirm the order and tell you how to pay.",
      after: "Your order is confirmed once we receive your payment. We'll email you when it is.",
    },
    test: {
      method: "Test payment",
    },
  },
} as const;
