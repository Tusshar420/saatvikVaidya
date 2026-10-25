// Strings for /checkout, the test payment screen, the confirmation and
// failure pages, and the order messages. Keep user-facing text here so Hindi
// can be added later.

const count = (n: number) => n.toLocaleString("en-IN");

export const checkout = {
  metaTitle: "Checkout",
  eyebrow: "Checkout",
  title: "Almost there.",
  titleEmphasis: "Where should we deliver?",
  // Carts with only courses or ebooks: nothing is delivered, the address
  // goes on the GST invoice.
  digitalTitleEmphasis: "Where should we send the invoice?",

  steps: {
    address: "Delivery address",
    addressDigital: "Billing address (for your invoice)",
    review: "Review and pay",
  },

  address: {
    pickLabel: "Choose a delivery address",
    none: "Add the address we should deliver to.",
    add: "Add a new address",
    edit: "Edit",
    editLabel: (name: string) => `Edit address for ${name}`,
    cancel: "Cancel",
    save: "Save address",
    saved: "Address saved",
    formTitleNew: "New address",
    formTitleEdit: "Edit address",
    phoneLine: (phone: string) => `Phone: ${phone}`,
    fields: {
      name: "Full name",
      phone: "Mobile number",
      phoneHelp: "10 digits. The courier may call this number.",
      line1: "House or flat number, building",
      line2: "Street, area or locality",
      landmark: "Landmark",
      city: "City or town",
      state: "State or union territory",
      chooseState: "Choose a state",
      pincode: "PIN code",
    },
    errors: {
      name: "Enter the full name of the person receiving the order.",
      phone: "Enter a 10-digit Indian mobile number.",
      line1: "Enter the house or flat number and building.",
      line2: "Keep this under 200 characters.",
      landmark: "Keep this under 120 characters.",
      city: "Enter the city or town.",
      state: "Choose the state or union territory.",
      pincode: "Enter a 6-digit PIN code.",
      pincodeState: "This PIN code isn't in the state you chose. Check both.",
      tooMany: (n: number) =>
        `You can save up to ${count(n)} addresses. Edit one of them instead.`,
      notFound: "That address wasn't found. Refresh the page and try again.",
      form: "Check the highlighted fields.",
    },
  },

  /** Printed as the "pack" of an ebook line on orders and invoices (P1.8). */
  ebookPackSize: "Ebook, PDF download",

  summary: {
    title: "Order summary",
    quantity: (n: number) => `Qty ${count(n)}`,
    lineLabel: (name: string, n: number) => `${name}, quantity ${count(n)}`,
    editCart: "Edit cart",
  },

  place: {
    button: "Place order and pay",
    note: "You'll see the payment screen next. Prices are checked again when you place the order.",
    manualButton: "Place order",
    manualNote:
      "You'll see how to pay by QR code or bank transfer next. Prices are checked again when you place the order.",
    needAddress: "Choose or add a delivery address first.",
    errors: {
      address: "Choose a delivery address.",
      empty: "Your cart is empty.",
      cartChanged:
        "Something in your cart changed (price, stock or availability). Check your cart and try again.",
      paymentsOff: "Online payment is not available right now.",
      checkoutOff: "We're not taking new orders right now. Please try again later.",
      coins: "Your coins changed, so they couldn't be used. Check the summary and try again.",
      generic: "We couldn't place your order. Please try again.",
    },
  },

  paymentsOff: {
    title: "Online payment is coming soon",
    line: (phone: string) =>
      `You can't pay online yet. To place this order, call ${phone} and our team will take it from there.`,
  },

  pay: {
    metaTitle: "Payment",
    eyebrow: "Payment",
    title: "Pay for your order",
    testBadge: "Test mode",
    testTitle: "Test payment - no money is taken",
    testLine:
      "Online payment isn't connected yet. Choose what should happen to see how the order continues.",
    order: (number: string) => `Order ${number}`,
    amount: "Amount to pay",
    attempt: (n: number) => `Attempt ${count(n)}`,
    success: "Simulate success",
    failure: "Simulate failure",
    start: "Continue to payment",
    noAttempt: "This order isn't waiting for a payment right now.",
    manual: {
      badge: "Pay by QR or bank transfer",
      title: "Your order is placed. Now pay to confirm it.",
      line: "Pay the amount below using the QR code or the bank details. Your order goes ahead as soon as we see the payment.",
      scanTitle: "Scan with any UPI app",
      scanLabel: (amount: string) => `UPI QR code for ${amount}`,
      upiId: "UPI ID",
      bankTitle: "Or pay by bank transfer",
      payee: "Name",
      bankName: "Bank",
      accountNumber: "Account number",
      ifsc: "IFSC code",
      reference: "Write this order number in the payment note",
      note: "Good to know",
      afterTitle: "What happens next",
      after:
        "We check the payment and mark your order paid, usually within a few working hours. You'll get a confirmation and can follow it on your orders page.",
      notReady: (phone: string) =>
        `Our payment details are not set up yet. Please call ${phone} and we will share them.`,
      viewOrders: "View my orders",
    },
  },

  confirmation: {
    metaTitle: "Order confirmed",
    eyebrow: "Order confirmed",
    title: "Thank you!",
    titleEmphasis: "Your order is confirmed.",
    line: (number: string) =>
      `Order ${number} is paid. We'll pack it and keep you posted.`,
    testNote: "This was a test payment: no money was taken.",
    orderNumber: "Order number",
    placedOn: "Placed on",
    paid: "Amount paid",
    deliverTo: "Delivering to",
    items: "Items",
    trackingLine: "Follow its delivery step by step on your order page.",
    viewOrder: "View order and tracking",
    continueShopping: "Continue shopping",
  },

  failed: {
    metaTitle: "Payment failed",
    eyebrow: "Payment failed",
    title: "The payment didn't go through.",
    titleEmphasis: "Your order is saved.",
    line: (number: string) =>
      `Order ${number} is waiting for payment. Your cart and our stock haven't changed, so you can try again.`,
    outOfStock:
      "An item in this order sold out before the payment finished, so the payment was stopped. No money was taken.",
    tryAgain: "Try again",
    backToCart: "Back to cart",
  },

  status: {
    pending_payment: "Waiting for payment",
    paid: "Paid",
    payment_failed: "Payment failed",
    cancelled: "Cancelled",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    returned: "Returned",
  },

  /** Messages sent through the dev notifier (printed to the server log). */
  messages: {
    confirmed: {
      subject: (number: string) => `Order ${number} confirmed`,
      body: (
        name: string,
        number: string,
        total: string,
        items: string[],
        address: string,
      ) =>
        [
          `Namaste ${name},`,
          "",
          `Thank you for your order. Order ${number} is paid and confirmed.`,
          "",
          ...items.map((item) => `- ${item}`),
          "",
          `Total paid: ${total}`,
          `Delivering to: ${address}`,
          "",
          "We'll let you know when it ships.",
          "",
          "Saatvik Vaidya",
        ].join("\n"),
      item: (name: string, quantity: number, total: string) =>
        `${name} × ${count(quantity)}: ${total}`,
      sms: (number: string, total: string) =>
        `Saatvik Vaidya: order ${number} is confirmed. Paid ${total}. We'll let you know when it ships.`,
    },
  },
} as const;

export type OrderStatusKey = keyof typeof checkout.status;
