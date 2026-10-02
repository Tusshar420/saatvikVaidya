"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { brand as copy } from "@/content/brand";
import { brandProofUpload, proofNoteMax } from "@/lib/brand-stage";
import { cn } from "@/lib/cn";

const text = copy.admin.detail;

/**
 * Sends a label proof: a file and an optional note, posted to
 * /api/brand-orders/[id]/proofs (which checks the type from the bytes and
 * the admin's session). The page refreshes to show the new version.
 */
export function BrandProofUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [, startTransition] = useTransition();
  const fileIds = useFieldIds(undefined, { help: text.uploadHelp });
  const noteIds = useFieldIds(undefined, { help: text.noteHelp });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage({ tone: "error", text: text.results.noFile });
      return;
    }
    if (file.size > brandProofUpload.maxBytes) {
      setMessage({ tone: "error", text: text.results.tooLarge });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/brand-orders/${orderId}/proofs`, { method: "POST", body: data });
      const result = (await response.json().catch(() => null)) as
        | { ok: true; version: number }
        | { ok: false; message?: string }
        | null;
      if (!result?.ok) {
        setMessage({ tone: "error", text: (result && "message" in result && result.message) || text.results.generic });
        return;
      }
      setMessage({ tone: "success", text: text.uploaded(result.version) });
      form.current?.reset();
      startTransition(() => router.refresh());
    } catch {
      setMessage({ tone: "error", text: text.results.generic });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={submit} aria-label={text.uploadTitle} className="flex flex-col gap-4">
      <Field ids={fileIds} label={text.fileLabel} help={text.uploadHelp}>
        <input
          id={fileIds.inputId}
          name="file"
          type="file"
          accept={brandProofUpload.accept}
          aria-describedby={fileIds.describedBy}
          className={cn(inputClasses, "h-auto py-2.5")}
        />
      </Field>
      <Field ids={noteIds} label={text.noteLabel} help={text.noteHelp} optional>
        <textarea
          id={noteIds.inputId}
          name="note"
          rows={3}
          maxLength={proofNoteMax}
          aria-describedby={noteIds.describedBy}
          className={cn(inputClasses, "h-auto py-3 leading-normal")}
        />
      </Field>
      <Button
        type="submit"
        loading={busy}
        icon={<Upload aria-hidden className="size-4.5" />}
        className="self-start max-sm:w-full"
      >
        {busy ? text.uploading : text.upload}
      </Button>
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
    </form>
  );
}
