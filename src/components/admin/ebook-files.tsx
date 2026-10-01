"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { admin as copy } from "@/content/admin";
import { ebookCoverUpload, ebookDownloadHref, ebookFileUpload } from "@/lib/ebooks";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/verification";

const text = copy.ebooks.files;

export type EbookFilesProps = {
  ebookId: number;
  cover: string | null;
  file: { name: string; sizeBytes: number } | null;
};

/** An ebook's cover and PDF: what's there now, and uploads to replace them. */
export function EbookFiles({ ebookId, cover, file }: EbookFilesProps) {
  return (
    <section
      id="files"
      aria-labelledby="files-title"
      className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 id="files-title" className="text-h3 text-ink">
        {text.title}
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-extrabold text-ink">{text.currentCover}</p>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own image route
            <img
              src={cover}
              alt=""
              className="h-40 w-28 rounded-md border border-line bg-surface-alt object-cover"
            />
          ) : (
            <p className="text-small text-muted">{text.noCover}</p>
          )}
          <UploadForm
            ebookId={ebookId}
            kind="cover"
            label={text.coverLabel}
            help={text.coverHelp(formatFileSize(ebookCoverUpload.maxBytes))}
            accept={ebookCoverUpload.accept}
            maxBytes={ebookCoverUpload.maxBytes}
          />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-extrabold text-ink">{text.currentBook}</p>
          {file ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm break-all text-ink">
                {text.currentFile(file.name, formatFileSize(file.sizeBytes))}
              </p>
              <a
                href={ebookDownloadHref(ebookId)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal underline-offset-4 hover:underline"
              >
                <Download aria-hidden className="size-4" />
                {text.download}
              </a>
            </div>
          ) : (
            <p className="text-small text-muted">{text.noFile}</p>
          )}
          <UploadForm
            ebookId={ebookId}
            kind="file"
            label={text.fileLabel}
            help={text.fileHelp(formatFileSize(ebookFileUpload.maxBytes))}
            accept={ebookFileUpload.accept}
            maxBytes={ebookFileUpload.maxBytes}
          />
        </div>
      </div>
    </section>
  );
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done" }
  | { status: "error"; message: string };

function UploadForm({
  ebookId,
  kind,
  label,
  help,
  accept,
  maxBytes,
}: {
  ebookId: number;
  kind: "cover" | "file";
  label: string;
  help: string;
  accept: string;
  maxBytes: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const error = state.status === "error" ? state.message : undefined;
  const ids = useFieldIds(undefined, { help, error });

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosen = form.get("file");
    if (!(chosen instanceof File) || chosen.size === 0) {
      setState({ status: "error", message: text.errors.empty });
      return;
    }
    if (chosen.size > maxBytes) {
      setState({ status: "error", message: text.errors.tooLarge(formatFileSize(maxBytes)) });
      return;
    }
    setState({ status: "uploading" });
    try {
      const response = await fetch(`/api/admin/ebooks/${ebookId}/files`, {
        method: "POST",
        body: form,
      });
      const reply = (await response.json()) as { ok: boolean; message?: string };
      if (!reply.ok) {
        setState({ status: "error", message: reply.message ?? text.errors.failed });
        return;
      }
      formRef.current?.reset();
      setState({ status: "done" });
      router.refresh();
    } catch {
      setState({ status: "error", message: text.errors.failed });
    }
  }

  return (
    <form ref={formRef} onSubmit={upload} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={kind} />
      {state.status === "done" && <FormAlert tone="success">{text.uploaded}</FormAlert>}
      <Field ids={ids} label={label} help={help} error={error}>
        <input
          id={ids.inputId}
          type="file"
          name="file"
          accept={accept}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(
            inputClasses,
            "cursor-pointer py-2.5 file:mr-3 file:rounded-sm file:border-0 file:bg-teal-soft file:px-3 file:py-1 file:font-bold file:text-teal",
          )}
        />
      </Field>
      <div>
        <Button
          type="submit"
          variant="secondary"
          loading={state.status === "uploading"}
          icon={<Upload aria-hidden className="size-4" />}
        >
          {state.status === "uploading" ? text.uploading : text.upload}
        </Button>
      </div>
    </form>
  );
}
