import { Download, ExternalLink, FileText } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { brand as copy } from "@/content/brand";
import type { BrandProofStatus } from "@/generated/prisma/enums";
import { isImageLogo } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { formatFileSize } from "@/lib/verification";

const text = copy.proof;

const variants: Record<BrandProofStatus, BadgeVariant> = {
  pending: "orange",
  approved: "brand",
  changes_requested: "blue",
  superseded: "soon",
};

export type ProofListItem = {
  id: number;
  version: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  status: BrandProofStatus;
  comment: string | null;
  createdAt: Date;
};

/**
 * Every version of a brand order's label proof, newest first (P2.2), for the
 * customer and the admin alike. Files come from /api/brand-orders/[id]/proofs/[version],
 * which checks who is asking. The newest image proof is shown in place; PDFs
 * download (no PDF viewer runs under our CSP).
 */
export function ProofList({
  orderId,
  proofs,
  commentLabel = text.yourComment,
}: {
  orderId: string;
  /** Newest first. */
  proofs: readonly ProofListItem[];
  /** What the customer's comment is called ("Your changes", or the admin's wording). */
  commentLabel?: string;
}) {
  return (
    <ol aria-label={text.title} className="flex flex-col gap-4">
      {proofs.map((proof, index) => {
        const src = `/api/brand-orders/${orderId}/proofs/${proof.version}`;
        const image = isImageLogo(proof.contentType);
        return (
          <li key={proof.id} className="min-w-0 rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="text-base font-extrabold text-ink">{text.version(proof.version)}</h3>
              {index === 0 && <Badge variant="gold">{text.latest}</Badge>}
              <Badge variant={variants[proof.status]}>{text.statuses[proof.status]}</Badge>
              <span className="text-small text-muted">{text.sentOn(formatDate(proof.createdAt))}</span>
            </div>
            {index === 0 && image && (
              <div className="mt-3 grid place-items-center overflow-hidden rounded-lg border border-line bg-surface-alt p-2">
                {/* Plain <img>: a private route serves it; next/image would need a loader. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${text.title}: ${text.version(proof.version)}`}
                  className="max-h-96 max-w-full object-contain"
                />
              </div>
            )}
            <p className="mt-3 flex min-w-0 items-center gap-2 text-small text-muted">
              <FileText aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                {proof.fileName} · {formatFileSize(proof.sizeBytes)}
              </span>
            </p>
            {proof.note && (
              <p className="mt-2 text-sm text-ink">
                <span className="font-bold">{text.note}: </span>
                <span className="break-words whitespace-pre-line">{proof.note}</span>
              </p>
            )}
            {proof.comment && (
              <p className="mt-2 text-sm text-ink">
                <span className="font-bold">{commentLabel}: </span>
                <span className="break-words whitespace-pre-line">{proof.comment}</span>
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-5">
              {image && (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={text.viewLabel(proof.version)}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand hover:underline"
                >
                  <ExternalLink aria-hidden className="size-4" />
                  {text.view}
                </a>
              )}
              <a
                href={`${src}?download=1`}
                aria-label={text.downloadLabel(proof.version)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand hover:underline"
              >
                <Download aria-hidden className="size-4" />
                {text.download}
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
