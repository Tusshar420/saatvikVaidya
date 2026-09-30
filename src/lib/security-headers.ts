/**
 * Security headers sent with every response (wired up in next.config.ts).
 *
 * The CSP follows the Next.js "without nonces" setup: App Router pages include
 * inline bootstrap scripts, so script-src needs 'unsafe-inline' unless we move
 * to per-request nonces (which forces dynamic rendering). Development also
 * needs 'unsafe-eval' (React debug stacks) and websockets for hot reload.
 */

export type SecurityHeaderOptions = {
  isDev: boolean;
  /**
   * The site's own origin (BETTER_AUTH_URL). `upgrade-insecure-requests` is
   * only sent when it's https (or unknown): on a plain-http production build,
   * such as the local e2e server, it turns same-site redirects into https
   * requests that fail.
   */
  siteOrigin?: string;
};

/** True unless the site is known to be served over plain http. */
export function shouldUpgradeInsecureRequests({
  isDev,
  siteOrigin,
}: SecurityHeaderOptions): boolean {
  if (isDev) return false;
  return !siteOrigin?.startsWith("http:");
}

export type Header = { key: string; value: string };

export function contentSecurityPolicy(options: SecurityHeaderOptions): string {
  const { isDev } = options;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "media-src": ["'self'", "blob:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "frame-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, sources]) => `${name} ${sources.join(" ")}`,
  );
  if (shouldUpgradeInsecureRequests(options))
    policy.push("upgrade-insecure-requests");

  return policy.join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    // Legacy twin of frame-ancestors 'none' for older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()",
        "browsing-topics=()",
        "camera=()",
        "geolocation=()",
        "gyroscope=()",
        "magnetometer=()",
        "microphone=()",
        "payment=()",
        "usb=()",
      ].join(", "),
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

/** Path of the route that serves uploaded documents (see next.config.ts). */
export const documentFilePath = "/api/documents/:path*";

/**
 * Overrides for uploaded files (/api/documents/[id]), applied after the
 * site-wide headers. The admin review page shows PDFs in an iframe, so these
 * may be framed by the site itself (and nothing else). The files are only
 * PDFs and images, so their CSP allows nothing to run or load.
 */
export function documentFileHeaders(): Header[] {
  return [
    {
      key: "Content-Security-Policy",
      value:
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ];
}
