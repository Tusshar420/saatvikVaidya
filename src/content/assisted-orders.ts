// Orders our staff prepare for customers who call or message us: the admin
// pages, the customer's page for a prepared order, and the link and code
// messages sent to the customer.

const count = (n: number) => n.toLocaleString("en-IN");
const items = (n: number) => `${count(n)} ${n === 1 ? "item" : "items"}`;

export const assistedOrders = {
  statuses: {
    open: "Waiting for customer",
    placed: "Order placed",
    cancelled: "Cancelled",
    expired: "Link expired",
  },

  admin: {
    nav: "Orders for customers",
    keywords: "phone order, whatsapp order, place order for customer, assisted, prepare order, link, code, otp",
    metaTitle: "Orders for customers",
    eyebrow: "Sales",
    title: "Orders for customers",
    description:
      "Prepare an order for a customer who called or messaged us. Send them a link to finish it on their account, or confirm it on the call with a code sent to them.",
    newButton: "Prepare an order",
    statusFilter: "Status",
    all: "All",
    filter: "Filter",
    caption: "Orders prepared for customers, newest first",
    columns: {
      customer: "Customer",
      items: "Items",
      status: "Status",
      preparedBy: "Prepared by",
      created: "Prepared on",
      open: "Open",
    },
    itemCount: items,
    empty: "No orders prepared yet.",
    emptyFiltered: "No prepared orders match this filter.",
    openLabel: (name: string) => `Open the order prepared for ${name}`,
    unknownStaff: "Removed staff account",

    create: {
      metaTitle: "Prepare an order",
      back: "Back to orders for customers",
      eyebrow: "Orders for customers",
      title: "Prepare an order",
      customerStep: "1. Find the customer",
      customerHelp:
        "Search by name, mobile number or email. The customer needs an account on the site; if they don't have one, ask them to sign up first.",
      searchLabel: "Name, mobile or email",
      searchPlaceholder: "e.g. 98765 43210",
      search: "Search",
      noMatches: "No customer matches. Check the spelling, or ask them to sign up first.",
      typeMore: "Type at least 3 letters or digits.",
      resultsLabel: "Matching customers",
      choose: "Choose",
      chooseLabel: (name: string) => `Choose ${name}`,
      change: "Change customer",
      customerTitle: "Customer",
      productsStep: "2. Add the medicines",
      productsHelp: "Prices are worked out for this customer when the order is placed.",
      productSearchLabel: "Find a medicine",
      productSearchPlaceholder: "Name, brand or pack size",
      productResultsLabel: "Medicines that match",
      addProduct: "Add",
      addProductLabel: (name: string) => `Add ${name}`,
      noProducts: "No medicine matches.",
      moreProducts: (n: number) => `${count(n)} more match. Type more to narrow the list.`,
      chosenTitle: "In this order",
      noneChosen: "No medicines added yet.",
      quantity: "Quantity",
      quantityLabel: (name: string) => `Quantity of ${name}`,
      minimum: (n: number) => `Minimum ${count(n)}`,
      remove: "Remove",
      removeLabel: (name: string) => `Remove ${name}`,
      noteStep: "3. Message to the customer",
      noteLabel: "Message",
      noteHelp: "Shown with the order and in the message we send. For example: \"As discussed on the phone today.\"",
      submit: "Save and send link",
      submitNote:
        "We email the link (SMS too, once SMS is set up on the site), and the order shows on the customer's account.",
      errors: {
        customer: "Choose the customer again; that account was not found.",
        items: "Add at least one medicine.",
        tooMany: "An order can hold up to 50 different medicines.",
        product: "One of the medicines is no longer for sale. Remove it and try again.",
        quantity: (name: string, min: number) => `${name}: the quantity must be at least ${count(min)}.`,
        admin: "Orders can't be prepared for staff accounts.",
        generic: "The order could not be saved. Please try again.",
      },
    },

    detail: {
      metaTitle: (name: string) => `Order prepared for ${name}`,
      back: "Back to orders for customers",
      eyebrow: "Order prepared for a customer",
      title: (name: string) => `For ${name}`,
      preparedOn: (by: string, when: string) => `Prepared by ${by} on ${when}`,
      expiresOn: (when: string) => `Link works until ${when}`,
      customerTitle: "Customer",
      phone: "Mobile",
      email: "Email",
      noContact: "No mobile or email on file",
      openCustomer: "Open account",
      itemsTitle: "Items",
      itemsCaption: "Items in this prepared order, priced for the customer",
      columns: { product: "Medicine", unit: "Price each", quantity: "Qty", total: "Total" },
      unavailable: "Not available now",
      totals: {
        subtotal: "Items total",
        delivery: "Delivery",
        free: "Free",
        total: "Total",
        note: "Today's price for this customer, including GST. It is worked out again when the order is placed.",
      },
      noteTitle: "Message to the customer",
      placedTitle: "Order placed",
      placedLine: (by: "customer" | "staff", when: string) =>
        by === "customer"
          ? `The customer finished this order from the link on ${when}.`
          : `Placed by our staff on ${when}, after the customer confirmed it with their code.`,
      openOrder: "Open the order",
      cancelledLine: "This prepared order was cancelled. The customer can no longer place it.",
      expiredLine: "The link has expired. Prepare a new order if the customer still wants it.",

      linkTitle: "Option 1: send the link",
      linkLine:
        "The customer opens the link, signs in, picks the address and places the order. It also shows under \"Your orders\" on their account.",
      linkLabel: "Link for the customer",
      copy: "Copy link",
      copied: "Link copied",
      whatsapp: "Share on WhatsApp",
      whatsappText: (name: string, link: string) =>
        `Namaste ${name}, we have prepared your Saatvik Vaidya order. Please open this link to check it and place it: ${link}`,
      resend: "Send link again",
      resent: (channels: string) => `Link sent again by ${channels}.`,
      sentBy: (channels: string) => `Link sent by ${channels}. It also shows on the customer's account.`,
      sentNowhere:
        "The customer has no email address, and SMS isn't set up on the site yet. Copy the link or share it on WhatsApp. It also shows on their account.",
      channels: { sms: "SMS", email: "email", both: "SMS and email" },

      phoneTitle: "Option 2: confirm on the call",
      phoneLine:
        "Pick the delivery address with the customer, then send them a code. When they read the code back to you, type it in to place the order for them.",
      addressLabel: "Delivery address",
      noAddress: "The customer has no saved address yet. Add one below.",
      addAddress: "Add an address for the customer",
      sendCode: "Send code to customer",
      sendCodeAgain: "Send a new code",
      codeSent: (where: string, minutes: number) => `Code sent to the customer by ${where}. It works for ${minutes} minutes.`,
      codeNowhere:
        "The customer has no email address for the code, and SMS isn't set up on the site yet. Send them the link instead (Option 1).",
      codeLabel: "Code the customer reads out",
      codeHelp: "6 digits.",
      place: "Place the order",
      placeNote: "The order is placed on the customer's account. They get the payment details as usual.",
      errors: {
        not_found: "This prepared order was not found.",
        closed: "This order is no longer open.",
        expired: "The link has expired. Prepare a new order.",
        no_contact: "The customer has no email address for the code, and SMS isn't set up yet. Send them the link instead.",
        rate_limited: "Too many codes sent. Wait a few minutes and try again.",
        no_code: "Send a code to the customer first.",
        code_format: "Type the 6-digit code the customer reads out.",
        code_expired: "The code has expired. Send a new one.",
        wrong_code: (left: number) =>
          left > 0
            ? `That code is not right. ${count(left)} ${left === 1 ? "try" : "tries"} left.`
            : "That code is not right. Send a new code.",
        too_many_tries: "Too many wrong codes. Send a new code.",
        address: "Choose a delivery address.",
        empty: "The order has no items that can be bought.",
        cart_changed: "A price or the stock changed. Check the items and try again.",
        payments_off: "Ordering is paused on the site right now.",
        checkout_off: "Ordering is paused on the site right now.",
        coins: "The order could not be placed. Please try again.",
        generic: "Something went wrong. Please try again.",
      },

      cancelTitle: "Cancel this prepared order",
      cancelLine: "The link stops working and it leaves the customer's account. Nothing has been charged.",
      cancel: "Cancel prepared order",
      cancelled: "Prepared order cancelled.",
      activityTitle: "Activity",
      activityEmpty: "Nothing yet.",
    },
  },

  /** The customer's side. */
  customer: {
    metaTitle: "Order prepared for you",
    eyebrow: "Prepared by our team",
    title: "Your order is",
    titleEmphasis: "ready to place",
    intro: (by: string) =>
      `${by} from Saatvik Vaidya prepared this order for you. Check the items, choose the delivery address and place it.`,
    team: "Our team",
    noteTitle: "Message from our team",
    expiresOn: (when: string) => `This link works until ${when}.`,
    placeButton: "Place this order",
    placedTitle: "This order has been placed",
    placedLine: "You can follow it on your orders page.",
    openOrder: "Open the order",
    cancelledTitle: "This order was withdrawn",
    cancelledLine: "Our team cancelled it. Please call us if you still need these medicines.",
    expiredTitle: "This link has expired",
    expiredLine: "Please call us and we'll prepare the order again.",
    callUs: (phone: string) => `Call ${phone}`,
    myOrders: "Your orders",
    notYoursTitle: "This link is for another account",
    notYoursLine:
      "It opens only for the account we prepared the order for. Sign out, then sign in with the mobile number or email we sent the link to.",
    errors: {
      closed: "This order is no longer open. Refresh the page to see why.",
    },
    /** The box on /orders. */
    list: {
      title: "Prepared for you by our team",
      line: "Check these orders and place them when you're ready.",
      label: "Orders prepared for you",
      summary: (n: number, total: string) => `${items(n)} · ${total}`,
      open: "Review and place",
      openLabel: (when: string) => `Review and place the order prepared on ${when}`,
      preparedOn: (when: string) => `Prepared ${when}`,
    },
  },

  /** Messages to the customer. */
  notify: {
    link: {
      sms: (name: string, link: string) =>
        `Saatvik Vaidya: Namaste ${name}, we have prepared your order. Check it and place it here: ${link}`,
      email: {
        subject: "Your Saatvik Vaidya order is ready to place",
        preheader: "Check the items and place the order in a few taps.",
        heading: "We prepared your order",
        line: "As you asked, our team has prepared this order for you. Check the items, choose the delivery address and place it. You pay only after placing it.",
        noteTitle: "Message from our team",
        itemsTitle: "Items",
        button: "Review and place the order",
        expires: (when: string) => `This link works until ${when}.`,
      },
      bell: {
        title: "An order is ready for you",
        body: (n: number) => `Our team prepared an order of ${items(n)}. Review it and place it.`,
      },
    },
    code: {
      sms: (code: string, total: string, minutes: number) =>
        `Saatvik Vaidya: ${code} is your code to confirm the order our team prepared for you (${total}). Share it only with our staff on your call. Valid for ${minutes} minutes.`,
      email: {
        subject: (code: string) => `${code} is your code to confirm your order`,
        heading: "Confirm your order",
        line: (total: string) =>
          `Our team is placing an order for you (${total}). Read this code to them on your call to confirm it.`,
        warning: "If you did not ask us to place an order, don't share this code. Just ignore this email.",
        expires: (minutes: number) => `The code works for ${minutes} minutes.`,
      },
    },
  },
} as const;
