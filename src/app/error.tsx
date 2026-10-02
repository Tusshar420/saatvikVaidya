"use client";

import { ErrorScreen } from "@/components/error-screen";

// The root error boundary: a page or layout below the root crashed.
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />;
}
