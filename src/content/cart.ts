// Strings for the cart: /cart, "Add to cart" on the product page and the
// cart's error messages. Keep user-facing text here so Hindi can be added
// later.

const count = (n: number) => n.toLocaleString("en-IN");
const units = (n: number) => (n === 1 ? "1 unit" : `${count(n)} units`);

export const cart = {
  metaTitle: "Cart",
  eyebrow: "My Order List",
  title: "Review your products.",
  titleEmphasis: "Check quantities, then check out.",
  itemCount: (n: number) => (n === 1 ? "1 product" : `${count(n)} products`),
  listLabel: "Products in your cart",

  empty: {
    title: "Your cart is empty",
    line: "Browse the catalogue and add the formulations you need.",
    action: "Browse products",
  },

  line: {
    packSize: (size: string) => `Pack: ${size}`,
    unitPrice: (price: string) => `${price} each`,
    bulkPrice: "Bulk price",
    professionalPrice: "Professional price",
    quantity: "Quantity",
    quantityFor: (name: string) => `Quantity of ${name}`,
    decrease: (name: string) => `One less ${name}`,
    increase: (name: string) => `One more ${name}`,
    update: "Update",
    remove: "Remove",
    removeLabel: (name: string) => `Remove ${name} from cart`,
    lineTotal: "Item total",
    moq: (n: number) => `Minimum order ${units(n)}`,
    available: (n: number) => `${units(n)} available`,
  },

  /** Problems with a line that block checkout until fixed. */
  issues: {
    unavailable: "This product is no longer available. Remove it to continue.",
    outOfStock: "Out of stock. Remove it to continue.",
    belowMoq: (n: number) => `The minimum order is ${units(n)}. Increase the quantity to continue.`,
    aboveStock: (n: number) => `Only ${units(n)} in stock. Reduce the quantity to continue.`,
    summary: "Fix the highlighted items to check out.",
  },

  summary: {
    title: "Order summary",
    subtotal: "Items total",
    gstAt: (rate: number) => `Includes GST at ${rate}%`,
    shipping: "Delivery",
    free: "Free",
    freeFrom: (amount: string) => `Free delivery on orders from ${amount}.`,
    addForFree: (amount: string) => `Add ${amount} more for free delivery.`,
    total: "Total",
    pricesNote: "Prices include GST and are checked again at checkout.",
    checkout: "Check out",
    signInToCheckout: "Sign in to check out",
    continueShopping: "Continue shopping",
  },

  add: {
    button: "Add to cart",
    quantity: "Quantity",
    added: "Added to your cart",
    addedLine: (name: string) => `${name} is in your cart.`,
    viewCart: "View cart",
    outOfStock: "Out of stock",
    outOfStockLine: (phone: string) =>
      `This product is out of stock right now. Call ${phone} to ask when it's back.`,
  },

  /** The "Add to cart" button on product cards in listings. */
  quickAdd: {
    button: "Add to Order",
    buttonLabel: (name: string) => `Add to Order: ${name}`,
    quantityFor: (name: string) => `Quantity of ${name} to add`,
    decrease: (name: string) => `One less ${name}`,
    increase: (name: string) => `One more ${name}`,
    added: "Added",
    addedLabel: (name: string) => `Added: add more ${name}`,
    addedLine: (name: string) => `${name} is in your cart.`,
    viewCart: "View cart",
    outOfStock: "Out of stock",
  },

  /** Paid ebooks in the cart (P1.8). */
  ebook: {
    listLabel: "Ebooks in your cart",
    kind: "Ebook (PDF)",
    by: (author: string) => `by ${author}`,
    note: "Download from your account once paid. Nothing to deliver.",
    unavailable: "This ebook is no longer for sale. Remove it to continue.",
    owned: "You already have this ebook. Remove it to continue.",
  },

  updated: "Cart updated",
  removed: "Removed from your cart",

  /** Messages for refused cart changes (shown in a toast or inline). */
  errors: {
    ebookOwned: "You already have this ebook. Download it from your account.",
    unavailable: "This product is no longer available.",
    outOfStock: "This product is out of stock.",
    belowMoq: (n: number) => `The minimum order for this product is ${units(n)}.`,
    aboveStock: (n: number) => `Only ${units(n)} in stock.`,
    tooManyLines: (n: number) => `A cart can hold up to ${count(n)} different products.`,
    invalid: "Enter a whole number of units.",
    rateLimited: "Too many changes in a short time. Please wait a few minutes and try again.",
    generic: "Something went wrong. Please try again.",
  },
} as const;
