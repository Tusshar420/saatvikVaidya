"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { brandLogoUpload } from "@/lib/brand";
import { formatFileSize } from "@/lib/verification";
import { LogoPreview, type LogoPreviewProps } from "./logo-preview";

const text = copy.packaging.logo;

/**
 * A saved brand's logo: a file picker that uploads straight away to
 * /api/launch/logo (which checks the type from the bytes), then refreshes
 * the page so the preview shows the stored file.
 */
export function LogoUpload({
  profileId,
  brandName,
  logo,
}: {
  profileId: number;
  brandName: string;
  logo: Omit<LogoPreviewProps, "alt" | "className"> | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setError(null);
    setDone(false);
    if (file.size > brandLogoUpload.maxBytes) {
      setError(text.errors.tooLarge(formatFileSize(brandLogoUpload.maxBytes)));
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("profileId", String(profileId));
      form.set("file", file);
      const response = await fetch("/api/launch/logo", { method: "POST", body: form });
      const result = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; message?: string }
        | null;
      if (!result?.ok) {
        setError((result && "message" in result && result.message) || text.errors.failed);
        return;
      }
      setDone(true);
      startTransition(() => router.refresh());
    } catch {
      setError(text.errors.failed);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  const describedBy = [error && "logo-error", "logo-help"].filter(Boolean).join(" ");
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby="logo-help">
      <legend className="text-xs font-extrabold text-ink">{text.label}</legend>
      <p id="logo-help" className="-mt-1 text-small text-muted">
        {text.help}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {logo && <LogoPreview {...logo} alt={text.previewAlt(brandName)} />}
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            id="logo-file"
            type="file"
            accept={brandLogoUpload.accept}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            variant="secondary"
            loading={uploading}
            icon={<Upload aria-hidden className="size-4" />}
            aria-describedby={describedBy}
            onClick={() => input.current?.click()}
            className="w-fit max-sm:w-full"
          >
            {uploading ? text.uploading : logo ? text.replace : text.upload}
          </Button>
          {done && !uploading && (
            <p role="status" className="text-small font-bold text-success">
              {text.uploaded}
            </p>
          )}
        </div>
      </div>
      {error && <FormAlert id="logo-error">{error}</FormAlert>}
    </fieldset>
  );
}
