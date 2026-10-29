import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/phone";
import { footerColumns, policyLinks, shell } from "@/content/shell";
import { Logo } from "./logo";
import { SiteModalButton } from "./site-modals";

export type FooterProps = {
  tagline: string;
  /**
   * @deprecated The v2 footer has no assistance note (the support number
   * sits in the Support column); kept so callers still type-check.
   */
  supportNote?: string;
  phone: string;
  className?: string;
};

// 44 px tap targets, though the mockup's links sit 10 px apart.
const linkClasses =
  "inline-flex min-h-6.5 items-center text-left text-small text-night-ink transition hover:text-white focus-visible:outline-white max-sm:min-h-11";

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-heading text-small font-extrabold text-white">{title}</h2>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  if (href === "modal:track-order") {
    return (
      <SiteModalButton modal="trackOrder" className={cn(linkClasses, "cursor-pointer")}>
        {label}
      </SiteModalButton>
    );
  }
  return (
    <Link href={href} className={linkClasses}>
      {label}
    </Link>
  );
}

/**
 * v2 site footer (`.footer`): the white logo, tagline and Hindi line, the
 * Explore / Products / Support columns, and the legal row with the policy
 * links.
 */
export function Footer({ tagline, phone, className }: FooterProps) {
  // Rendered at build time; the year updates with each deploy.
  const year = new Date().getFullYear();
  return (
    <footer
      className={cn(
        "bg-night pt-12.5 pb-9 text-white sm:pt-16.25 sm:pb-10 max-sm:pb-[calc(36px+68px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="shell grid grid-cols-2 gap-x-6.25 gap-y-8.75 md:grid-cols-[1.6fr_1fr_1fr] md:gap-x-16 lg:grid-cols-[1.8fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <Logo
            tone="light"
            imageClassName="h-20 w-41.25 sm:h-20 sm:w-41.25 md:h-20 md:w-41.25"
            className="focus-visible:outline-white"
          />
          <p className="mt-2.5 max-w-70 text-small text-night-ink">{tagline}</p>
          <p lang="hi" className="mt-3.5 text-small text-gold">
            {shell.footer.hindiLine}
          </p>
        </div>
        {footerColumns.map((column) => (
          <Column key={column.title} title={column.title}>
            {column.links.map((link) => (
              <li key={link.href}>
                <FooterLink href={link.href} label={link.label} />
              </li>
            ))}
          </Column>
        ))}
        <div className="md:col-start-2 md:col-end-4 lg:col-auto">
          <Column title={shell.footer.supportTitle}>
            <li>
              <a
                href={telHref(phone)}
                aria-label={shell.footer.call(phone)}
                className={linkClasses}
              >
                {phone}
              </a>
            </li>
            <li>
              <FooterLink href="/partner" label={shell.footer.partner} />
            </li>
            <li>
              <FooterLink href="/why-saatvik" label={shell.footer.why} />
            </li>
            <li>
              <SiteModalButton
                modal="reportProblem"
                className={cn(linkClasses, "cursor-pointer")}
              >
                {shell.footer.reportProblem}
              </SiteModalButton>
            </li>
          </Column>
        </div>
      </div>
      <div className="shell mt-8.75 flex flex-col gap-1.75 border-t border-white/10 pt-5 text-[11px] text-night-ink sm:mt-11.25 md:flex-row md:items-center md:justify-between">
        <p>
          {shell.footer.copyright(year)}. {shell.footer.rights}
        </p>
        <div className="flex flex-col gap-1.75 md:flex-row md:items-center md:gap-6">
          <nav aria-label={shell.footer.policiesLabel}>
            <ul className="flex flex-wrap gap-x-4">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={cn(linkClasses, "text-[11px]")}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p>{shell.footer.builtFor}</p>
        </div>
      </div>
    </footer>
  );
}
