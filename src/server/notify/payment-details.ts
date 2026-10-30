import "server-only";
import QRCode from "qrcode";
import { emails as copy } from "@/content/emails";
import { formatPaise } from "@/lib/format";
import { upiLink } from "@/lib/upi";
import { getSetting } from "@/server/content/settings";
import type { PaymentProviderName } from "@/server/payments";
import { siteLink } from "./compose";
import type { EmailBlock, EmailRow } from "./email";

// "How to pay" in the order-placed emails, the same details as the pay page
// (src/components/site/checkout/manual-payment.tsx): a UPI QR code with the
// amount and order number filled in, the UPI ID and the bank details from
// the "payment.manual" setting. Anything the admin left empty is left out.

const text = copy.payment;

/** The payment method in words, for order details. */
export function paymentMethodLabel(provider: PaymentProviderName): string {
  return text[provider].method;
}

export async function paymentBlocks(
  order: { id: string; number: string; totalPaise: number },
  provider: PaymentProviderName,
  /** Brand orders have their own pay page path. */
  payPath = `/checkout/pay/${order.id}`,
): Promise<EmailBlock[]> {
  if (provider === "request") {
    return [
      { kind: "note", title: text.request.title, text: text.request.line },
      { kind: "text", text: text.request.after },
    ];
  }
  if (provider !== "manual") return [];

  const amount = formatPaise(order.totalPaise);
  const details = await getSetting("payment.manual");
  const hasBank = Boolean(details.bankName || details.accountNumber || details.ifsc);
  if (!details.upiId && !hasBank) {
    const phone = await getSetting("contact.phone");
    return [{ kind: "note", title: text.manual.title, text: text.manual.notReady(phone), tone: "warning" }];
  }

  const blocks: EmailBlock[] = [{ kind: "note", title: text.manual.title, text: text.manual.line(amount), tone: "warning" }];
  if (details.upiId) {
    const qr = await QRCode.toBuffer(upiLink(details, order.totalPaise, order.number), {
      type: "png",
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
      // A QR code must be plain black on white to scan reliably, so these are not theme tokens.
      color: { dark: "#000000", light: "#ffffff" },
    });
    blocks.push({
      kind: "image",
      image: { cid: `qr-${order.number}@saatvikvaidya`, filename: `pay-${order.number}.png`, content: qr, contentType: "image/png" },
      alt: text.manual.qrAlt(amount),
      size: 180,
      caption: text.manual.scan,
    });
  }
  const rows: EmailRow[] = [
    { label: text.manual.amount, value: amount },
    { label: text.manual.upiId, value: details.upiId },
    { label: text.manual.payee, value: details.payeeName },
    { label: text.manual.bankName, value: details.bankName },
    { label: text.manual.accountNumber, value: details.accountNumber },
    { label: text.manual.ifsc, value: details.ifsc },
  ].filter((row) => row.value);
  blocks.push({ kind: "details", rows });
  blocks.push({ kind: "text", text: text.manual.reference(order.number) });
  if (details.note) blocks.push({ kind: "text", text: details.note });
  blocks.push({ kind: "text", text: text.manual.after });
  blocks.push({ kind: "button", label: text.manual.payNow, href: siteLink(payPath) });
  return blocks;
}
