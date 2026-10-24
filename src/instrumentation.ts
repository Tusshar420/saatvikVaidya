import type { Instrumentation } from "next";

/**
 * Runs once when the server starts. On a server it refuses to start with
 * settings that would break sign-in or mix test and live data
 * (src/server/site-check.ts). Not during `next build`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertSiteSettings } = await import("@/server/site-check");
  assertSiteSettings();
}

/**
 * Records every unhandled server error (route handlers, server actions,
 * server components) in the error log. Runs only in the Node server; the
 * logger itself never throws.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordServerError } = await import("@/server/errors/server");
  await recordServerError(error, request, context);
};
