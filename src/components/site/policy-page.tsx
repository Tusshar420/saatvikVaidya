import Link from "next/link";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { telHref } from "@/lib/phone";
import { policyPages, type PolicyPageCopy } from "@/content/pages";
import { policyLinks, type PolicyHref } from "@/content/shell";

export type PolicyPageProps = {
  copy: PolicyPageCopy;
  /** This page's route, so it's left out of "Other policies". */
  href: PolicyHref;
  phone: string;
};

/** Placeholder policy page until the real text is written. */
export function PolicyPage({ copy, href, phone }: PolicyPageProps) {
  const others = policyLinks.filter((link) => link.href !== href);
  return (
    <div className="shell section-y">
      <article className="mx-auto max-w-2xl">
        <Eyebrow>{policyPages.eyebrow}</Eyebrow>
        <h1 className="mt-3 text-h2 text-ink">{copy.title}</h1>
        <Badge variant="soon" className="mt-6">
          {policyPages.status}
        </Badge>
        <p className="mt-4 text-body-lg text-muted">{policyPages.body}</p>
        <p className="mt-3 text-body text-muted">
          {policyPages.contactLead}{" "}
          <a
            href={telHref(phone)}
            className="inline-flex min-h-11 items-center font-bold text-brand underline-offset-4 hover:underline"
          >
            {policyPages.call(phone)}
          </a>
        </p>
        <nav aria-label={policyPages.otherPolicies} className="mt-8">
          <h2 className="text-label text-muted uppercase">
            {policyPages.otherPolicies}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-5">
            {others.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          href="/"
          className={buttonClasses({ variant: "secondary", className: "mt-8" })}
        >
          {policyPages.backHome}
          <ButtonArrow />
        </Link>
      </article>
    </div>
  );
}
