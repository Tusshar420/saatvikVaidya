"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon, Upload } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { verification as copy } from "@/content/verification";
import { cn } from "@/lib/cn";
import {
  documentUpload,
  formatFileSize,
  isDocumentContentType,
  type DocumentType,
} from "@/lib/verification";

export type CurrentDocument = {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Already formatted on the server, so it matches the page's time zone. */
  uploadedOn: string;
  verified: boolean;
};

const maxSize = formatFileSize(documentUpload.maxBytes);

/** The browser's quick check; the server checks the real type again. */
function checkFile(file: File): string | null {
  if (file.size === 0) return copy.errors.empty;
  if (file.size > documentUpload.maxBytes) return copy.errors.tooLarge(maxSize);
  const byName = /\.(pdf|jpe?g|png)$/i.test(file.name);
  if (!isDocumentContentType(file.type) && !byName) return copy.errors.fileType;
  return null;
}

/**
 * One required document on /account: what's on file, and (unless the account
 * is verified) a picker with a preview, an upload progress bar and errors.
 * Uploads go to POST /api/account/documents; the page then refreshes to show
 * the new file and status.
 */
export function DocumentUpload({
  documentType,
  current,
  locked,
}: {
  documentType: DocumentType;
  current: CurrentDocument | null;
  locked: boolean;
}) {
  const { label, help } = copy.documentTypes[documentType];
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  // Object URLs hold the file in memory until revoked.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function reset() {
    setFile(null);
    setPreview(null);
    setProgress(null);
  }

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = "";
    if (!chosen) return;
    const problem = checkFile(chosen);
    setError(problem);
    if (problem) {
      reset();
      return;
    }
    setFile(chosen);
    setPreview(
      chosen.type.startsWith("image/") ? URL.createObjectURL(chosen) : null,
    );
  }

  function upload() {
    if (!file || uploading) return;
    setError(null);
    setProgress(0);
    const form = new FormData();
    form.append("documentType", documentType);
    form.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/account/documents");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const body = request.response as
        | { ok: true; complete: boolean }
        | { ok: false; message?: string }
        | null;
      if (request.status === 200 && body?.ok) {
        toast({
          title: copy.uploaded(label),
          description: body.complete ? copy.submitted : undefined,
          tone: "success",
        });
        reset();
        router.refresh();
      } else {
        setProgress(null);
        setError((body && !body.ok && body.message) || copy.errors.failed);
      }
    };
    request.onerror = () => {
      setProgress(null);
      setError(copy.errors.failed);
    };
    request.send(form);
  }

  const headingId = `${id}-title`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const pickerText = current ? copy.replace : copy.choose;

  return (
    <li
      aria-labelledby={headingId}
      className="flex flex-col rounded-lg border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="text-base font-extrabold text-ink">
          {label}
        </h3>
        {current?.verified && <Badge variant="brand">{copy.verifiedBadge}</Badge>}
      </div>
      <p id={helpId} className="mt-0.5 text-small text-muted">
        {help}
      </p>

      {current ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-md bg-surface-alt p-3">
          <FileIcon type={current.contentType} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold break-words text-ink">
              {current.fileName}
            </p>
            <p className="text-small text-muted">
              {formatFileSize(current.sizeBytes)} ·{" "}
              {copy.uploadedOn(current.uploadedOn)}
            </p>
          </div>
          <a
            href={`/api/documents/${current.id}`}
            target="_blank"
            rel="noopener"
            aria-label={copy.viewNamed(label)}
            className="-my-1.5 inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-bold text-brand underline-offset-4 hover:underline"
          >
            {copy.view}
          </a>
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-surface-alt p-3 text-sm font-semibold text-muted">
          {copy.missing}
        </p>
      )}

      {!locked && (
        <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
          {file && (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong p-3">
              {preview ? (
                // A local preview (blob: URL), not a remote image.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt={copy.previewAlt(label)}
                  className="size-16 shrink-0 rounded-sm border border-line object-cover"
                />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-sm bg-brand-soft">
                  <FileText aria-hidden className="size-7 text-brand" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-small font-bold text-brand">{copy.selected}</p>
                <p className="text-sm font-semibold break-words text-ink">
                  {file.name}
                </p>
                <p className="text-small text-muted">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          )}

          {uploading && (
            <div className="flex flex-col gap-1.5">
              <div
                role="progressbar"
                aria-label={copy.progressLabel(label)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 overflow-hidden rounded-full bg-brand-soft"
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-small font-semibold text-muted">
                {copy.uploading} {progress}%
              </p>
            </div>
          )}

          {error && (
            <FormAlert id={errorId} tone="error">
              {error}
            </FormAlert>
          )}

          {file ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                loading={uploading}
                onClick={upload}
                icon={<Upload aria-hidden className="size-4" />}
                aria-label={copy.uploadNamed(label)}
              >
                {copy.upload}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={uploading}
                onClick={() => {
                  reset();
                  setError(null);
                }}
              >
                {copy.cancel}
              </Button>
            </div>
          ) : (
            <div>
              <input
                id={`${id}-file`}
                type="file"
                accept={documentUpload.accept}
                onChange={choose}
                aria-label={copy.fileFor(pickerText, label)}
                aria-describedby={cn(helpId, error && errorId)}
                className="peer sr-only"
              />
              <label
                htmlFor={`${id}-file`}
                className={buttonClasses({
                  variant: "secondary",
                  size: "sm",
                  className:
                    "w-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand sm:w-auto",
                })}
              >
                <Upload aria-hidden className="size-4" />
                {pickerText}
              </label>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function FileIcon({ type }: { type: string }) {
  const Icon = type === "application/pdf" ? FileText : ImageIcon;
  return <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />;
}
