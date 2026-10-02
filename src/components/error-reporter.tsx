"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

/** Sends uncaught browser errors and unhandled promise rejections to the error log. Renders nothing. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) =>
      reportClientError(event.error ?? event.message, "error", { filename: event.filename || undefined });
    const onRejection = (event: PromiseRejectionEvent) =>
      reportClientError(event.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
