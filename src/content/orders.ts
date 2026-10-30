// Strings for /orders, /orders/[id], /track (and the Track Order modal), and
// the delivery messages. Keep user-facing text here so Hindi can be added
// later.

const count = (n: number) => n.toLocaleString("en-IN");

export const orders = {
  list: {
    metaTitle: "My orders",
    eyebrow: "My orders",
    title: "Your orders,",
    titleEmphasis: "every step in one place.",
    listLabel: "Orders",
    emptyTitle: "No orders yet",
    emptyLine: "When you place an order, it shows here and you can follow its delivery.",
    shop: "Browse products",
    placedOn: (date: string) => `Placed ${date}`,
    items: (n: number) => `${count(n)} ${n === 1 ? "item" : "items"}`,
    view: "View order",
    viewLabel: (number: string) => `View order ${number}`,
    payNow: "Complete payment",
    previous: "Newer orders",
    next: "Older orders",
    page: (current: number, total: number) => `Page ${current} of ${total}`,
  },

  /** The signed-out /orders page. */
  guest: {
    title: "Sign in to see your orders",
    description:
      "Your orders, delivery tracking, invoices and payment reminders are saved to your account.",
    perks: ["Live delivery tracking", "Invoices & documents", "Complete pending payments"],
    signIn: "Sign in / Register",
    trackTitle: "Ordered without an account?",
    trackText: "Check an order with its number and the mobile number or email used for it.",
    trackOrder: "Track an order",
    shop: "Browse products",
  },

  detail: {
    metaTitle: (number: string) => `Order ${number}`,
    eyebrow: "Order",
    back: "All orders",
    placedOn: "Placed on",
    total: "Total",
    status: "Status",
    deliverTo: "Delivering to",
    payment: "Payment",
    paymentLine: (provider: string, attempt: number) =>
      `${provider === "test" ? "Test payment" : provider === "manual" ? "QR or bank transfer" : provider === "request" ? "Arranged by our team" : provider} · attempt ${count(attempt)}`,
    paymentStatus: {
      created: "Waiting for payment",
      succeeded: "Paid",
      failed: "Failed",
    },
    testNote: "This was a test payment: no money was taken.",
    reference: (ref: string) => `Reference ${ref}`,
    payNow: "Complete payment",
    items: "Items",
    tracking: "Delivery",
    help: "Questions about this order?",
    call: (phone: string) => `Call ${phone}`,
  },

  status: {
    pending_payment: "Waiting for payment",
    paid: "Confirmed",
    payment_failed: "Payment failed",
    cancelled: "Cancelled",
    processing: "Being prepared",
    shipped: "Shipped",
    delivered: "Delivered",
    returned: "Returned",
  },

  /** The steps of the customer's tracking timeline. */
  steps: {
    confirmed: "Confirmed",
    packed: "Packed",
    shipped: "Shipped",
    in_transit: "In transit",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
  },

  /** Shipment steps, as shown in the history list (and the admin panel). */
  shipmentStatus: {
    created: "Shipment created",
    packed: "Packed",
    shipped: "Shipped",
    in_transit: "In transit",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    undelivered: "Delivery attempt failed",
    returned: "Returned to us",
    cancelled: "Shipment cancelled",
  },

  tracking: {
    timelineLabel: (number: string) => `Delivery progress for order ${number}`,
    courier: "Courier",
    awb: "Tracking number",
    testCourier: "Test delivery: the courier and tracking number are simulated.",
    notShipped: "We're preparing your order. The courier and tracking number show here once it ships.",
    historyTitle: "Tracking history",
    historyLabel: "Tracking history, newest first",
    awaitingPayment: "This order is waiting for payment. Tracking starts once it's paid.",
    paymentFailed: "The payment for this order didn't go through, so it hasn't been sent.",
    cancelled: "This order was cancelled. If you had already paid, our team will contact you about your refund.",
    undelivered: "The courier couldn't deliver this order. They'll try again, or call us to arrange it.",
    returned: "This order came back to us undelivered. Call us to arrange another delivery.",
    delivered: "Delivered. Thank you for ordering from Saatvik Vaidya.",
  },

  track: {
    metaTitle: "Track your order",
    eyebrow: "Track order",
    title: "Know exactly",
    titleEmphasis: "what happens next.",
    heroTitle: "Every order, clearly tracked.",
    description: "Enter your order number and the mobile number or email used for the order.",
    heroDescription:
      "Check current progress and review previous orders, using your order number and the mobile number or email on it.",
    noteStatus: "Built for professionals",
    noteTitle: "Two clear journeys",
    noteText:
      "Build Your Brand includes label approval and production. Top Brands follows packing and dispatch.",
    resultEyebrow: "Order status",
    previousTitle: "Previous orders",
    previousSignedOut: "Sign in to access your complete history.",
    previousSignedIn: "Your latest orders. Open one for its full timeline and documents.",
    previousEmpty: "No orders yet. When you place one, it shows here.",
    signIn: "Sign In",
    viewAll: "View all orders",
    number: "Order number",
    numberPlaceholder: "Example: SV-7K2Q9F4M",
    numberHelp: "It's in your order confirmation, starting SV-.",
    contact: "Mobile number or email",
    contactPlaceholder: "98765 43210 or you@example.com",
    submit: "View order status",
    again: "Check again",
    errors: {
      number: "Enter the order number, like SV-7K2Q9F4M.",
      contact: "Enter a 10-digit mobile number or an email address.",
      notFound:
        "We couldn't find an order with these details. Check the order number and use the mobile number or email from the order.",
      rateLimited: "Too many tries. Please wait a few minutes and try again.",
    },
    resultTitle: (number: string) => `Order ${number}`,
    signedInHint: "Signed in? Your orders are under",
    myOrders: "My orders",
    helpLead: "Need an update now?",
    call: (phone: string) => `Call ${phone}`,
    close: "Close",
  },

  /** Emails and SMS about deliveries and cancellations (src/server/notify/orders.ts). */
  messages: {
    shipment: {
      /** Steps that also send an email or SMS; the others only show in the bell. */
      emailSteps: ["shipped", "out_for_delivery", "delivered", "undelivered", "returned", "cancelled"],
      subjects: {
        created: (number: string) => `We're preparing your order ${number}`,
        packed: (number: string) => `Your order ${number} is packed`,
        shipped: (number: string) => `Shipped: your order ${number} is on its way`,
        in_transit: (number: string) => `Your order ${number} is in transit`,
        out_for_delivery: (number: string) => `Out for delivery: your order ${number} arrives today`,
        delivered: (number: string) => `Delivered: your order ${number}`,
        undelivered: (number: string) => `Delivery attempt failed: order ${number}`,
        returned: (number: string) => `Returned to us: order ${number}`,
        cancelled: (number: string) => `Shipment cancelled: order ${number}`,
      },
      headings: {
        created: "We're preparing your order.",
        packed: "Your order is packed.",
        shipped: "Your order is on its way!",
        in_transit: "Your order is in transit.",
        out_for_delivery: "Arriving today!",
        delivered: "Your order has been delivered.",
        undelivered: "We couldn't deliver your order.",
        returned: "Your order came back to us.",
        cancelled: "The shipment for your order was cancelled.",
      },
      lines: {
        created: "We're preparing your order for dispatch.",
        packed: "Your order is packed and ready for the courier.",
        shipped: "Your order is on its way.",
        in_transit: "Your order is in transit.",
        out_for_delivery: "Your order is out for delivery today.",
        delivered: "Your order has been delivered.",
        undelivered: "The courier couldn't deliver your order. They'll try again soon.",
        returned: "Your order came back to us undelivered. Please call us to arrange delivery.",
        cancelled: "The shipment for your order was cancelled.",
      },
      /** The longer line in the email, under the heading. */
      details: {
        created: (number: string) => `We're getting order ${number} ready for the courier.`,
        packed: (number: string) => `Order ${number} is packed and waiting for the courier.`,
        shipped: (number: string) =>
          `Good news! Order ${number} has left our warehouse. You can follow it any time from your order page.`,
        in_transit: (number: string) => `Order ${number} is moving through the courier's network.`,
        out_for_delivery: (number: string) =>
          `Order ${number} is out for delivery and should reach you today. Please keep your phone close so the courier can call you.`,
        delivered: (number: string) =>
          `Order ${number} has been delivered. We hope you love it! If anything isn't right, please call us and we'll sort it out.`,
        undelivered: (number: string) =>
          `The courier tried to deliver order ${number} but couldn't. They'll try again soon. To arrange a time, please call us.`,
        returned: (number: string) =>
          `Order ${number} came back to us undelivered. Please call us and we'll arrange delivery again.`,
        cancelled: (number: string) => `The shipment for order ${number} was cancelled. Please call us if you didn't expect this.`,
      },
      sms: (number: string, line: string) => `Saatvik Vaidya: order ${number}. ${line}`,
    },
    cancelled: {
      subject: (number: string) => `Your order ${number} has been cancelled`,
      preheader: (paid: boolean) =>
        paid ? "Our team will contact you about your refund." : "No payment was taken for it.",
      heading: "Your order has been cancelled.",
      line: (number: string) => `Order ${number} has been cancelled.`,
      paid: "You had already paid, so our team will contact you about your refund.",
      unpaid: "No payment was taken for it, so there's nothing more you need to do.",
      sms: (number: string) => `Saatvik Vaidya: order ${number} has been cancelled.`,
    },
  },
} as const;

export type OrderStatusLabelKey = keyof typeof orders.status;
