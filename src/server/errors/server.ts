import "server-only";
import { auth } from "@/server/auth";
import { recordError } from "./record";

type RequestInfo = { path: string; method: string; headers: { [key: string]: string | string[] | undefined } };
type ErrorContext = { routePath: string; routeType: string; renderSource?: string };

// Next's own control-flow "errors" (redirects, notFound) aren't bugs.
const controlFlow = /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/;

function header(headers: RequestInfo["headers"], name: string): string | null {
  const value = headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

async function userIdOf(headers: RequestInfo["headers"]): Promise<string | null> {
  const cookie = header(headers, "cookie");
  if (!cookie) return null;
  try {
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** Called from instrumentation.ts's onRequestError. Never throws. */
export async function recordServerError(error: unknown, request: RequestInfo, context: ErrorContext): Promise<void> {
  try {
    const digest =
      typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
    if (digest && controlFlow.test(digest)) return;
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-Error thrown");
    const host = header(request.headers, "host");
    await recordError({
      source: "server",
      message: err.message || err.name,
      stack: err.stack ?? null,
      // The route file pattern (e.g. /app/orders/[id]) groups better than the raw path.
      route: context.routePath || request.path,
      url: host ? `http://${host}${request.path}` : request.path,
      method: request.method,
      statusCode: 500,
      userId: await userIdOf(request.headers),
      userAgent: header(request.headers, "user-agent"),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      context: { digest, routeType: context.routeType, renderSource: context.renderSource },
    });
  } catch (loggingError) {
    console.error("[errors] couldn't record a server error", loggingError);
  }
}
