import type { SessionError } from "@/lib/bug-report";
import { isBrowserNoise } from "@/lib/error-scrub";

// Sends a browser error to /api/errors (Phase 4). Client-side caps keep one
// broken page from flooding the endpoint: each distinct error once per page
// load, and no more than five reports in all.

const maxReports = 5;
const sent = new Set<string>();

// The errors sent during this visit (this tab, across page loads), so
// "Report a problem" can attach them and link the report to the Error log.
const sessionKey = "sv:session-errors";
const sessionKept = 10;

function rememberSessionError(entry: SessionError): void {
  try {
    const kept = JSON.parse(sessionStorage.getItem(sessionKey) ?? "[]") as unknown;
    const list = Array.isArray(kept) ? kept : [];
    list.push(entry);
    sessionStorage.setItem(sessionKey, JSON.stringify(list.slice(-sessionKept)));
  } catch {
    // Storage full or blocked: the report just goes without them.
  }
}

/** The visit's errors as JSON, for the report form (the server checks every entry). */
export function sessionErrorsJson(): string {
  try {
    return sessionStorage.getItem(sessionKey) ?? "[]";
  } catch {
    return "[]";
  }
}

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
    rememberSessionError({
      message,
      stack: stack?.slice(0, 2000),
      url: location.href.slice(0, 1000),
      kind,
      at: Date.now(),
      digest: extra.digest,
    });

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
