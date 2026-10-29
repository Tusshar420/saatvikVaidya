import { brand as copy } from "@/content/brand";
import { brandLogoUpload } from "@/lib/brand";
import { formatFileSize } from "@/lib/verification";

const text = copy.packaging.logo;

/**
 * Sends a logo to /api/launch/logo (which checks the type from the bytes) for
 * one saved brand. Returns the message to show, or null when it worked.
 */
export async function uploadBrandLogo(profileId: number, file: File): Promise<string | null> {
  if (file.size > brandLogoUpload.maxBytes) {
    return text.errors.tooLarge(formatFileSize(brandLogoUpload.maxBytes));
  }
  try {
    const form = new FormData();
    form.set("profileId", String(profileId));
    form.set("file", file);
    const response = await fetch("/api/launch/logo", { method: "POST", body: form });
    const result = (await response.json().catch(() => null)) as
      | { ok: true }
      | { ok: false; message?: string }
      | null;
    if (result?.ok) return null;
    return (result && "message" in result && result.message) || text.errors.failed;
  } catch {
    return text.errors.failed;
  }
}
