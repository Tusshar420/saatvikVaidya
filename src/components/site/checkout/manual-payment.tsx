import QRCode from "qrcode";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { checkout as copy } from "@/content/checkout";
import type { SettingValues } from "@/content/settings";
import { formatPaise } from "@/lib/format";

const text = copy.pay.manual;

/** The UPI payment link a QR code opens in the customer's UPI app. */
export function upiLink(details: Pick<SettingValues["payment.manual"], "upiId" | "payeeName">, amountPaise: number, orderNumber: string): string {
  const params = new URLSearchParams({
    pa: details.upiId,
    pn: details.payeeName,
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: orderNumber,
  });
  return `upi://pay?${params.toString()}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="text-small text-muted sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="font-bold break-all text-ink select-all">{value}</dd>
    </div>
  );
}

/**
 * Pay-by-QR panel (PAYMENT_PROVIDER=manual): a UPI QR code with the amount
 * and order number filled in, the UPI ID, and the bank details. Anything the
 * admin left empty is left out. The QR is drawn as inline SVG on the server.
 */
export async function ManualPayment({
  details,
  amountPaise,
  orderNumber,
  phone,
}: {
  details: SettingValues["payment.manual"];
  amountPaise: number;
  orderNumber: string;
  phone: string;
}) {
  const hasBank = Boolean(details.bankName || details.accountNumber || details.ifsc);
  const qr = details.upiId
    ? await QRCode.toString(upiLink(details, amountPaise, orderNumber), {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        // A QR code must be plain black on white to scan reliably, so these are not theme tokens.
        color: { dark: "#000000", light: "#ffffff" },
      })
    : null;

  if (!qr && !hasBank) {
    return <p className="mt-5 text-body text-ink">{text.notReady(phone)}</p>;
  }

  return (
    <div className="mt-5 flex flex-col gap-5">
      <div>
        <Badge variant="soon">
          <Landmark aria-hidden className="size-3.5" />
          {text.badge}
        </Badge>
        <h2 className="mt-3 text-h3 text-ink">{text.title}</h2>
        <p className="mt-1.5 text-body text-ink">{text.line}</p>
      </div>

      {qr && (
        <section aria-labelledby="pay-scan" className="flex flex-col items-center gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-start sm:gap-6">
          <div
            role="img"
            aria-label={text.scanLabel(formatPaise(amountPaise))}
            className="size-48 shrink-0 overflow-hidden rounded-md border border-line bg-white p-1 [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="min-w-0">
            <h3 id="pay-scan" className="text-base font-extrabold text-ink">
              {text.scanTitle}
            </h3>
            <dl className="mt-1 divide-y divide-line">
              <Row label={text.payee} value={details.payeeName} />
              <Row label={text.upiId} value={details.upiId} />
            </dl>
          </div>
        </section>
      )}

      {hasBank && (
        <section aria-labelledby="pay-bank" className="rounded-lg border border-line p-4">
          <h3 id="pay-bank" className="text-base font-extrabold text-ink">
            {text.bankTitle}
          </h3>
          <dl className="mt-1 divide-y divide-line">
            <Row label={text.payee} value={details.payeeName} />
            {details.bankName && <Row label={text.bankName} value={details.bankName} />}
            {details.accountNumber && <Row label={text.accountNumber} value={details.accountNumber} />}
            {details.ifsc && <Row label={text.ifsc} value={details.ifsc} />}
          </dl>
        </section>
      )}

      <p className="rounded-lg bg-brand-soft p-3 text-sm text-ink">
        {text.reference}: <strong className="font-mono">{orderNumber}</strong>
      </p>
      {details.note && (
        <p className="text-sm text-muted">
          <strong className="text-ink">{text.note}:</strong> {details.note}
        </p>
      )}
      <div>
        <h3 className="text-base font-extrabold text-ink">{text.afterTitle}</h3>
        <p className="mt-1 text-sm text-muted">{text.after}</p>
      </div>
    </div>
  );
}
