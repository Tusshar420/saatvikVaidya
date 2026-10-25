// Strings for GST invoices and credit notes (P1.6): the PDF itself, and the
// download links on the buyer's order page and the admin order page. Keep
// user-facing text here so Hindi can be added later. (The PDF uses the
// standard Helvetica font, which has no "₹" or Devanagari, so amounts on it
// are in "Rs.".)

export type InvoiceKindKey = "invoice" | "credit_note";

export const invoices = {
  pdf: {
    title: { invoice: "Tax invoice", credit_note: "Credit note" },
    copy: "Original for recipient",
    gstin: (gstin: string) => `GSTIN: ${gstin}`,
    state: (name: string, gstCode: string) => `State: ${name} (code ${gstCode})`,
    number: { invoice: "Invoice no.", credit_note: "Credit note no." },
    date: "Date",
    orderNumber: "Order no.",
    orderDate: "Order date",
    againstInvoice: "Against invoice",
    againstInvoiceValue: (number: string, date: string) => `${number} dated ${date}`,
    reason: "Reason",
    reasonCancelled: "Order cancelled",
    placeOfSupply: "Place of supply",
    placeOfSupplyValue: (name: string, gstCode: string) => `${name} (${gstCode})`,
    reverseCharge: "Reverse charge",
    no: "No",
    buyer: "Billed and shipped to",
    phone: (phone: string) => `Phone: ${phone}`,
    amountsIn: "Amounts in Rs.",
    columns: {
      index: "#",
      item: "Item",
      hsn: "HSN/SAC",
      quantity: "Qty",
      taxable: "Taxable value",
      rate: "GST",
      cgst: "CGST",
      sgst: "SGST",
      igst: "IGST",
      amount: "Amount",
    },
    unitLine: (quantity: string, unit: string) => `${quantity} x Rs. ${unit} incl. GST`,
    deliveryCharge: "Delivery charge",
    totals: {
      taxable: "Taxable value",
      cgst: "CGST",
      sgst: "SGST",
      igst: "IGST",
      total: { invoice: "Total", credit_note: "Total credit" },
    },
    inWords: "Amount in words",
    testPayment:
      "Test order: paid with a test payment, so no money was taken. Not valid for tax purposes.",
    footer: "This is a computer-generated document and needs no signature.",
    page: (current: number, total: number) => `Page ${current} of ${total}`,
  },

  /** The downloaded file's name, e.g. "Invoice SV-26-27-00001.pdf". */
  fileName: (kind: InvoiceKindKey, number: string) =>
    `${kind === "invoice" ? "Invoice" : "Credit note"} ${number.replace(/\//g, "-")}.pdf`,

  /** The documents card on /orders/[id] and /admin/orders/[id]. */
  links: {
    title: "Invoices",
    listLabel: "Invoice downloads",
    invoice: "Tax invoice",
    creditNote: "Credit note",
    numbered: (number: string) => `No. ${number}`,
    pending: "Number given on first download",
    download: "Download PDF",
    downloadLabel: (document: string, orderNumber: string) =>
      `Download the ${document.toLowerCase()} for order ${orderNumber} (PDF)`,
    unpaid: "The tax invoice is ready once the order is paid.",
    creditNoteNote: "This order was cancelled after payment, so this credit note cancels the invoice.",
  },
};
