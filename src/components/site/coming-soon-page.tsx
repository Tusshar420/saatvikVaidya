import type { ReactNode } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import {
  ButtonArrow,
  ButtonGroup,
  buttonClasses,
} from "@/components/ui/button";
import { ComingSoon } from "@/components/ui/empty-state";
import { telHref } from "@/lib/phone";
import { comingSoonPages, type ComingSoonPageCopy } from "@/content/pages";

export type ComingSoonPageProps = {
  copy: ComingSoonPageCopy;
  icon: ReactNode;
  phone: string;
  /** Extra sentence before the line, e.g. echoing a search query. */
  lead?: string;
};

/**
 * Whole-page ComingSoon for routes whose feature isn't built yet (/orders,
 * /coins): a helpful line, a link home and a way to call.
 */
export function ComingSoonPage({
  copy,
  icon,
  phone,
  lead,
}: ComingSoonPageProps) {
  return (
    <div className="shell section-y">
      <ComingSoon
        as="h1"
        icon={icon}
        title={copy.title}
        description={lead ? `${lead} ${copy.line}` : copy.line}
        className="mx-auto max-w-2xl py-14"
        action={
          <ButtonGroup className="justify-center">
            <Link href="/" className={buttonClasses()}>
              {comingSoonPages.backHome}
              <ButtonArrow />
            </Link>
            <a
              href={telHref(phone)}
              className={buttonClasses({ variant: "secondary" })}
            >
              <Phone aria-hidden className="size-4" />
              {comingSoonPages.call(phone)}
            </a>
          </ButtonGroup>
        }
      />
    </div>
  );
}
