import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/phone";
import { sectionHref } from "@/lib/section-links";
import { homeSections, policyLinks, shell } from "@/content/shell";
import { Logo } from "./logo";
import { SiteModalButton } from "./site-modals";

export type FooterProps = {
  tagline: string;
  supportNote: string;
  phone: string;
  className?: string;
};

const linkClasses =
  "inline-flex min-h-11 items-center text-left text-sm text-night-ink transition hover:text-white focus-visible:outline-white";

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-small font-bold text-white">{title}</h2>
      <ul className="mt-2 flex flex-col">{children}</ul>
    </div>
  );
}

/**
 * Site footer: brand block, Platform and Support links, the assistance note
 * with the phone link, and the legal row with policy links.
 */
export function Footer({
  tagline,
  supportNote,
  phone,
  className,
}: FooterProps) {
  // Rendered at build time; the year updates with each deploy.
  const year = new Date().getFullYear();
  return (
    <footer
      className={cn(
        "bg-night pt-15 pb-6 text-white max-sm:pb-[calc(24px+67px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="shell grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr] lg:grid-cols-[1.6fr_0.7fr_0.7fr_1fr] lg:gap-12.5">
        <div className="sm:col-span-2 md:col-span-1">
          <Logo tone="light" className="focus-visible:outline-white" />
          <p className="mt-5.5 max-w-75 text-sm text-night-ink">{tagline}</p>
        </div>
        <Column title={shell.footer.platformTitle}>
          {shell.footer.platformLinks.map((id) => (
            <li key={id}>
              <Link href={sectionHref(id)} className={linkClasses}>
                {homeSections[id]}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/ebooks" className={linkClasses}>
              {shell.footer.ebooks}
            </Link>
          </li>
        </Column>
        <Column title={shell.footer.supportTitle}>
          <li>
            <SiteModalButton
              modal="trackOrder"
              className={cn(linkClasses, "cursor-pointer")}
            >
              {shell.footer.trackOrder}
            </SiteModalButton>
          </li>
          {shell.footer.supportLinks.map((id) => (
            <li key={id}>
              <Link href={sectionHref(id)} className={linkClasses}>
                {homeSections[id]}
              </Link>
            </li>
          ))}
        </Column>
        <div className="sm:col-span-2 md:col-span-3 lg:col-span-1">
          <h2 className="text-small font-bold text-white">
            {shell.footer.assistanceTitle}
          </h2>
          <p className="mt-3 max-w-md text-sm text-night-ink">{supportNote}</p>
          <a
            href={telHref(phone)}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-extrabold text-white underline-offset-4 hover:underline focus-visible:outline-white"
          >
            {shell.footer.call(phone)}
          </a>
        </div>
      </div>
      <div className="shell mt-11 flex flex-col gap-1 border-t border-white/10 pt-4.5 text-small text-night-ink sm:flex-row sm:items-center sm:justify-between">
        <p>{shell.footer.copyright(year)}</p>
        <nav aria-label={shell.footer.policiesLabel}>
          <ul className="flex flex-wrap gap-x-5">
            {policyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(linkClasses, "text-small")}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
