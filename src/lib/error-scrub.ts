// Pure helpers for the error log (Phase 4): scrubbing sensitive data,
// grouping errors by fingerprint, and ignoring browser noise. No
// "server-only" import: the browser reporter uses the noise checks too.

export const redacted = "[redacted]";

/** Keys whose values are never stored, in any casing or with - or _ between words. */
const sensitiveKey =
  /pass(word|wd|code)?|secret|token|otp|cvv|cvc|card|pan\b|upi|vpa|auth|cookie|session|credential|api[-_]?key|signature|jwt|bearer|pin\b/i;

export function isSensitiveKey(key: string): boolean {
  return sensitiveKey.test(key);
}

const maxTextLength = 4000;

const textRules: [RegExp, string | ((...match: string[]) => string)][] = [
  // JSON-ish: "password": "hunter2"  /  'token':'abc'
  [
    /(["']?)([\w.-]*(?:pass(?:word|wd|code)?|secret|token|otp|cvv|cvc|card[\w-]*|upi[\w-]*|vpa|auth[\w-]*|cookie|session[\w-]*|api[-_]?key|signature)[\w.-]*)\1(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&}\]]+)/gi,
    (_all, _quote, key, separator) => `${key}${separator}${redacted}`,
  ],
  // Authorization / cookie headers, whole line.
  [/\b(authorization|proxy-authorization|cookie|set-cookie)\s*:[^\n]*/gi, `$1: ${redacted}`],
  [/\bBearer\s+[\w.~+/=-]{8,}/gi, `Bearer ${redacted}`],
  // JSON web tokens.
  [/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/g, redacted],
  // "otp 123456", "code: 4821", "pin is 1234"
  [/\b(otp|code|pin|passcode)(\W{1,4}(?:is\W{1,3})?)\d{4,8}\b/gi, `$1$2${redacted}`],
  // Card numbers: 13 to 19 digits, in groups.
  [/\b(?:\d[ -]?){13,19}\b/g, redacted],
  // UPI ids look like an email whose domain has no dot: name@okhdfcbank.
  [/\b[\w.-]{2,}@[a-z][a-z0-9]{1,20}\b(?!\.)/gi, redacted],
];

/** Text with passwords, tokens, cookies, auth headers, card/UPI details and OTPs removed. */
export function scrubText(text: string, maxLength = maxTextLength): string {
  let result = text.length > maxLength * 2 ? text.slice(0, maxLength * 2) : text;
  for (const [pattern, replacement] of textRules) {
    result = result.replace(pattern, replacement as string);
  }
  return result.length > maxLength ? `${result.slice(0, maxLength)}…` : result;
}

/** Path segments that look like a secret or an id and shouldn't be stored or grouped on. */
const secretSegment = /^(?=.*\d)[A-Za-z0-9_-]{24,}$/;
const tokenRoutes = /^\/(reset-password|admin-invite|verify|invite)\//;

/**
 * The page or request a path belongs to, with ids turned into ":id" so
 * /orders/123 and /orders/456 are one route, and any link token removed.
 */
export function normalizeRoute(pathOrUrl: string): string {
  const path = pathOnly(pathOrUrl);
  const segments = path.split("/").map((segment, index) => {
    if (index === 0 || segment === "") return segment;
    if (/^\d+$/.test(segment)) return ":id";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return ":id";
    if (secretSegment.test(segment)) return ":id";
    return segment;
  });
  let route = segments.join("/") || "/";
  // Anything after a token route's first segment is the token.
  const tokenMatch = tokenRoutes.exec(path);
  if (tokenMatch) route = `/${tokenMatch[1]}/:token`;
  return route.length > 191 ? route.slice(0, 191) : route;
}

function pathOnly(value: string): string {
  const withoutHash = value.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(withoutQuery)) return new URL(withoutQuery).pathname || "/";
  } catch {
    // fall through: use the text as given
  }
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

/**
 * A URL safe to store: no fragment, no credentials, sensitive query values
 * redacted, link tokens in the path replaced. Unparsable input becomes its
 * scrubbed path.
 */
export function scrubUrl(value: string): string {
  const base = "http://placeholder.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return scrubText(value, 500);
  }
  const route = tokenRoutes.test(url.pathname)
    ? normalizeRoute(url.pathname)
    : url.pathname
        .split("/")
        .map((segment) => (secretSegment.test(segment) ? ":id" : segment))
        .join("/");
  const query = new URLSearchParams();
  for (const [key, val] of url.searchParams) {
    query.set(key, isSensitiveKey(key) ? redacted : scrubText(val, 100));
  }
  const search = query.toString();
  const origin = url.origin === base ? "" : url.origin;
  const result = `${origin}${route}${search ? `?${search}` : ""}`;
  return result.length > 500 ? `${result.slice(0, 500)}…` : result;
}

/**
 * A plain value (for the "context" an error carries) with sensitive keys
 * redacted and every string scrubbed. Depth, array length and string length
 * are capped, so request bodies can't be stored wholesale by accident.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return scrubText(value, 500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return scrubText(`${value.name}: ${value.message}`, 500);
  if (depth >= 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => scrubValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 20)) {
      out[key] = isSensitiveKey(key) ? redacted : scrubValue(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

// ─── Fingerprints ───────────────────────────────────────────────────────────

/** The message with ids, numbers and quoted values blanked, so "Order 41 failed" and "Order 42 failed" match. */
export function normalizeMessage(message: string): string {
  return scrubText(message, 300)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<id>")
    .replace(/\b[a-z0-9]{24,}\b/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The first useful stack frame as "function file" without line numbers,
 * build hashes or query strings, so one bug keeps one fingerprint across
 * deploys. Frames from browser extensions and node internals are skipped.
 */
export function topFrame(stack: string | null | undefined): string {
  if (!stack) return "";
  for (const line of stack.split("\n")) {
    const text = line.trim();
    if (!/^at\s|@/.test(text)) continue;
    if (/node:internal|node_modules[\\/]next[\\/]dist|extension:\/\//.test(text)) continue;
    return text
      .replace(/^at\s+/, "")
      .replace(/\?[^\s)]*/g, "")
      .replace(/:\d+(:\d+)?\)?$/, "")
      .replace(/\b[0-9a-f]{8,}\b/gi, "")
      .replace(/https?:\/\/[^/\s)]+/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 200);
  }
  return "";
}

export type FingerprintParts = {
  source: "server" | "browser";
  message: string;
  stack?: string | null;
  route: string;
};

/** The text that identifies one bug: where it ran, what it said, where it threw, which route. */
export function fingerprintText(parts: FingerprintParts): string {
  return [
    parts.source,
    normalizeMessage(parts.message),
    topFrame(parts.stack),
    normalizeRoute(parts.route),
  ].join("\n");
}

// ─── Noise and devices ──────────────────────────────────────────────────────

const botAgent =
  /bot\b|bot[/ ;)]|crawl|spider|slurp|headless|phantom|lighthouse|pagespeed|facebookexternalhit|preview|monitor|uptime|curl\/|wget\/|python-requests|httpclient|axios\/|node-fetch|go-http-client/i;

/** True for an empty or automated user agent. Their browser reports aren't stored. */
export function isBotAgent(userAgent: string | null | undefined): boolean {
  return !userAgent || botAgent.test(userAgent);
}

const extensionUrl = /(?:chrome|moz|safari|safari-web|ms-browser)-extension:\/\//i;

const noiseMessages = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /^(AbortError|The user aborted a request)/i,
  /The operation was aborted/i,
  /Non-Error promise rejection captured/i,
];

/**
 * True for browser errors not worth recording: from extensions or other
 * origins' scripts, cross-origin "Script error.", cancelled requests and the
 * harmless ResizeObserver warning.
 */
export function isBrowserNoise(error: {
  message: string;
  stack?: string | null;
  filename?: string | null;
}): boolean {
  if (noiseMessages.some((pattern) => pattern.test(error.message))) return true;
  if (error.filename && extensionUrl.test(error.filename)) return true;
  if (error.stack && extensionUrl.test(error.stack)) return true;
  return false;
}

export type Device = "mobile" | "tablet" | "desktop" | "bot" | "unknown";

export function deviceOf(userAgent: string | null | undefined): Device {
  if (!userAgent) return "unknown";
  if (botAgent.test(userAgent)) return "bot";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}
