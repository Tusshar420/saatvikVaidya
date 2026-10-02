import type { Instrumentation } from "next";

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
