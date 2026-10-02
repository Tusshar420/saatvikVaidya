import { isBrowserNoise } from "@/lib/error-scrub";

// Sends a browser error to /api/errors (Phase 4). Client-side caps keep one
// broken page from flooding the endpoint: each distinct error once per page
// load, and no more than five reports in all.

const maxReports = 5;
const sent = new Set<string>();

export type ClientErrorKind = "error" | "unhandledrejection" | "boundary";

export function reportClientError(
  error: unknown,
  kind: ClientErrorKind,
  extra: { filename?: string; digest?: string } = {},
): void {
  try {
    if (typeof window === "undefined" || sent.size >= maxReports) return;
    const err = error instanceof Error ? error : null;
    const message = (err?.message || (typeof error === "string" ? error : "") || "Unknown error").slice(0, 1000);
    const stack = err?.stack?.slice(0, 8000);
    // Scripts from other origins (ads, extensions) aren't ours to report.
    if (extra.filename) {
      try {
        if (new URL(extra.filename, location.href).origin !== location.origin) return;
      } catch {
        return;
      }
    }
    if (isBrowserNoise({ message, stack, filename: extra.filename })) return;
    const key = `${kind}|${message}|${stack?.split("\n")[1] ?? ""}`;
    if (sent.has(key)) return;
    sent.add(key);

    const body = JSON.stringify({
      message,
      stack,
      filename: extra.filename,
      url: location.href,
      kind,
      digest: extra.digest,
    });
    void fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting must never cause an error of its own.
  }
}
