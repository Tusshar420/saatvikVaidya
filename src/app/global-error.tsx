"use client";

import { ErrorScreen } from "@/components/error-screen";
import "./globals.css";

// Used when the root layout itself crashes, so it brings its own <html>.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ErrorScreen {...props} />
      </body>
    </html>
  );
}
