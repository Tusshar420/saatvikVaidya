"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { errorScreen as copy } from "@/content/errors";
import { reportClientError } from "@/lib/report-client-error";

/** The "something went wrong" screen for error boundaries; also reports the error. */
export function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "boundary", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <EmptyState
        as="h1"
        tone="orange"
        icon={<TriangleAlert aria-hidden />}
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>{copy.retry}</Button>
            <Link href="/" className={buttonClasses({ variant: "secondary" })}>
              {copy.home}
            </Link>
          </div>
        }
      />
      {error.digest && (
        <p className="mt-3 text-center text-small text-muted">{copy.reference(error.digest)}</p>
      )}
    </main>
  );
}
