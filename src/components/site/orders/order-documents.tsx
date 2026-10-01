import { Download, FileText } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { invoices as copy } from "@/content/invoices";
import { cn } from "@/lib/cn";
import type { OrderDocuments as Documents } from "@/server/invoices/invoices";

const text = copy.links;

type Props = {
  orderId: string;
  orderNumber: string;
  documents: Documents;
  /** Unpaid orders show when the invoice will be ready; cancelled unpaid ones show nothing. */
  showUnpaidNote: boolean;
  className?: string;
};

/**
 * The order's tax invoice and credit note downloads (P1.6), on /orders/[id]
 * and /admin/orders/[id]. The links go to routes that check the viewer is
 * the buyer or an admin. Nothing renders when there's nothing to say.
 */
export function OrderDocuments({ orderId, orderNumber, documents, showUnpaidNote, className }: Props) {
  const rows = [
    documents.invoice.available && {
      key: "invoice",
      label: text.invoice,
      number: documents.invoice.number,
      href: `/api/orders/${orderId}/invoice`,
    },
    documents.creditNote.available && {
      key: "credit-note",
      label: text.creditNote,
      number: documents.creditNote.number,
      href: `/api/orders/${orderId}/credit-note`,
    },
  ].filter((row) => row !== false);
  if (rows.length === 0 && !showUnpaidNote) return null;

  return (
    <Card as="section" aria-labelledby="order-documents" className={className}>
      <h2 id="order-documents" className="text-h3 text-ink">
        {text.title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{text.unpaid}</p>
      ) : (
        // Rows sit side by side only when the card itself is wide enough (the
        // admin page shows it in a narrow column, even on desktop).
        <ul aria-label={text.listLabel} className="@container mt-3 flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 @sm:flex-row @sm:items-center @sm:justify-between"
            >
              <span className="flex min-w-0 items-start gap-3">
                <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-teal" />
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{row.label}</span>
                  <span className={cn("block text-small text-muted", row.number && "font-mono whitespace-nowrap")}>
                    {row.number ? text.numbered(row.number) : text.pending}
                  </span>
                </span>
              </span>
              <a
                href={row.href}
                download
                aria-label={text.downloadLabel(row.label, orderNumber)}
                className={buttonClasses({ variant: "secondary", className: "w-full shrink-0 @sm:w-auto" })}
              >
                <Download aria-hidden className="size-4" />
                {text.download}
              </a>
            </li>
          ))}
        </ul>
      )}
      {documents.creditNote.available && <p className="mt-4 text-small text-muted">{text.creditNoteNote}</p>}
    </Card>
  );
}
