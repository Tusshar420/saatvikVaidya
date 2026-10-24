import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { announcement as copy } from "@/content/maintenance";
import { cn } from "@/lib/cn";
import { SiteModalButton } from "./site-modals";

export type AnnouncementBarProps = {
  /** The main line (bold). */
  text: string;
  /** A site path, "modal:sign-in", "modal:track-order", or null for plain text. */
  href: string | null;
  /** Extra detail after the main line; hidden under 820 px. */
  detail?: string;
  /**
   * A separate call to action ("View Coins →") after a divider. Without it,
   * the whole line is the link, as the admin's announcement setting expects.
   */
  linkLabel?: string;
  className?: string;
};

const linkClasses =
  "inline-flex min-h-7.5 cursor-pointer items-center hover:underline focus-visible:outline-white";

/**
 * The orange bar above the header (34 px, 30 under 560 px). Shows the
 * admin's announcement, or the Saatvik Coins message built from the coin
 * rules.
 */
export function AnnouncementBar({
  text,
  href,
  detail,
  linkLabel,
  className,
}: AnnouncementBarProps) {
  const line = (
    <span className="min-w-0 truncate">
      <b className="font-bold">{text}</b>
      {detail && <span className="max-md:hidden"> · {detail}</span>}
    </span>
  );

  const wrap = (children: ReactNode, label?: ReactNode) => {
    if (href === "modal:sign-in" || href === "modal:track-order") {
      return (
        <SiteModalButton
          modal={href === "modal:sign-in" ? "signIn" : "trackOrder"}
          className={linkClasses}
        >
          {label ?? children}
        </SiteModalButton>
      );
    }
    if (href) {
      return (
        <Link href={href} className={linkClasses}>
          {label ?? children}
        </Link>
      );
    }
    return children;
  };

  return (
    <div
      role="region"
      aria-label={copy.label}
      className={cn("relative z-110 bg-announcement text-white", className)}
    >
      <div className="shell flex h-7.5 items-center justify-between gap-2 text-[11px] sm:h-8.5 sm:text-small md:justify-center md:gap-6.5">
        {linkLabel ? (
          <>
            {line}
            {href &&
              wrap(
                null,
                <span className="inline-flex shrink-0 items-center gap-1 font-bold md:border-l md:border-white/35 md:pl-6.5">
                  {linkLabel}
                  <ArrowRight aria-hidden className="size-3.5" />
                </span>,
              )}
          </>
        ) : (
          <span className="mx-auto min-w-0">{wrap(line)}</span>
        )}
      </div>
    </div>
  );
}
