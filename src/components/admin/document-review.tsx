import { Download, ExternalLink, FileText, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { admin } from "@/content/admin";
import { formatDate } from "@/lib/format";
import { formatFileSize } from "@/lib/verification";
import type { DocumentView } from "@/server/verification/documents";

const text = admin.review;

/** Where a document's file is served (owner or admin only). */
export const documentHref = (id: number, download = false) =>
  `/api/documents/${id}${download ? "?download=1" : ""}`;

/**
 * One required document on the review page: its file with a preview (images
 * inline; PDFs in a frame from 820 px, since phone browsers don't show PDFs
 * inside pages), and links to open or download it.
 */
export function DocumentReview({
  label,
  help,
  document,
}: {
  label: string;
  help?: string;
  document: DocumentView | null;
}) {
  const headingId = `document-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <li
      aria-labelledby={headingId}
      className="rounded-lg border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={headingId} className="text-base font-extrabold text-ink">
            {label}
          </h3>
          {help && <p className="mt-0.5 text-small text-muted">{help}</p>}
        </div>
        {document?.verifiedAt && <Badge variant="brand">{text.verified}</Badge>}
      </div>

      {!document ? (
        <p className="mt-3 rounded-md bg-surface-alt px-3.5 py-3 text-sm font-semibold text-muted">
          {text.missing}
        </p>
      ) : (
        <>
          <p className="mt-3 flex min-w-0 items-center gap-2 text-sm text-ink">
            {document.contentType === "application/pdf" ? (
              <FileText aria-hidden className="size-4.5 shrink-0 text-brand" />
            ) : (
              <ImageIcon aria-hidden className="size-4.5 shrink-0 text-brand" />
            )}
            <span className="min-w-0 font-semibold break-words">
              {document.fileName}
            </span>
          </p>
          <p className="mt-0.5 text-small text-muted">
            {formatFileSize(document.sizeBytes)} ·{" "}
            {text.uploaded(formatDate(document.uploadedAt))}
          </p>

          <div className="mt-4 overflow-hidden rounded-md border border-line bg-surface-alt">
            {document.contentType === "application/pdf" ? (
              <>
                <iframe
                  src={documentHref(document.id)}
                  title={text.previewTitle(label)}
                  loading="lazy"
                  className="hidden h-140 w-full md:block"
                />
                <p className="px-3.5 py-3 text-small text-muted md:hidden">
                  {text.pdfOnPhones}
                </p>
              </>
            ) : (
              // Served by an authorised route, so next/image can't optimise it.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={documentHref(document.id)}
                alt={text.previewAlt(label)}
                loading="lazy"
                className="mx-auto max-h-140 w-auto max-w-full object-contain"
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
            <a
              href={documentHref(document.id)}
              target="_blank"
              rel="noopener"
              aria-label={text.openNamed(label)}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink aria-hidden className="size-4" />
              {text.open}
            </a>
            <a
              href={documentHref(document.id, true)}
              download={document.fileName}
              aria-label={text.downloadNamed(label)}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Download aria-hidden className="size-4" />
              {text.download}
            </a>
          </div>
        </>
      )}
    </li>
  );
}
