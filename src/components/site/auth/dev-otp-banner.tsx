"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { signIn as copy } from "@/content/sign-in";

const POLL_MS = 2000;

/**
 * Dev only: shows the latest code sent to `phone`, read from /api/dev/otp.
 * Only rendered when the server says DEV_SHOW_OTP is on outside production
 * (the route itself is a 404 otherwise).
 */
export function DevOtpBanner({ phone }: { phone: string }) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(
          `/api/dev/otp?phone=${encodeURIComponent(phone)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const body = (await response.json()) as {
          otp: { code: string } | null;
        };
        if (active) setCode(body.otp?.code ?? null);
      } catch {
        // Dev helper only; the SMS in the server log is the fallback.
      }
    };
    void load();
    // Keep polling so a resent code shows up too.
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [phone]);

  return (
    <aside
      aria-label={copy.devOtp.label}
      data-testid="dev-otp-banner"
      className="mb-5 rounded-lg border-2 border-dashed border-gold bg-gold-soft p-3.5 text-gold-ink"
    >
      <p className="flex items-center gap-2 text-label uppercase">
        <FlaskConical aria-hidden className="size-4" />
        {copy.devOtp.label}
      </p>
      <p className="mt-1.5 text-sm">
        {copy.devOtp.code}:{" "}
        {code ? (
          <strong className="font-mono text-base tracking-[0.2em]">
            {code}
          </strong>
        ) : (
          copy.devOtp.waiting
        )}
      </p>
      <p className="mt-1 text-small">{copy.devOtp.note}</p>
    </aside>
  );
}
