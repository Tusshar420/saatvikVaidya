import { FileText } from "lucide-react";
import { brand as copy } from "@/content/brand";
import { isImageLogo } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/verification";

export type LogoPreviewProps = {
  /** The route that serves the file to this viewer. */
  src: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  /** Alt text for an image logo. */
  alt: string;
  className?: string;
};

/**
 * A Launch Your Brand logo (P2.1): the image itself for PNG and JPEG, or a
 * file tile with a download link for a PDF. Files come from private routes
 * that check who is asking.
 */
export function LogoPreview({ src, name, contentType, sizeBytes, alt, className }: LogoPreviewProps) {
  if (isImageLogo(contentType)) {
    return (
      <div
        className={cn(
          "grid size-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface-alt p-2",
          className,
        )}
      >
        {/* Plain <img>: a private route serves it; next/image would need a loader. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <a
      href={src}
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-3 rounded-lg border border-line bg-surface-alt p-3 text-sm hover:border-teal/60",
        className,
      )}
    >
      <FileText aria-hidden className="size-8 shrink-0 text-teal" />
      <span className="min-w-0">
        <span className="block font-bold break-words text-ink">{name}</span>
        <span className="block text-small text-muted">
          {copy.packaging.logo.pdf} · {formatFileSize(sizeBytes)} · {copy.packaging.logo.view}
        </span>
      </span>
    </a>
  );
}
