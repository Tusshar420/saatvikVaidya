import Link from "next/link";
import { announcement as copy } from "@/content/maintenance";
import { SiteModalButton } from "./site-modals";

const barClasses =
  "block px-4 py-2 text-center text-small font-semibold text-white";

/**
 * The slim bar above the header. The text comes from the "site.announcement"
 * setting; its link is a site path or a site modal, or the bar is plain text.
 */
export function AnnouncementBar({ text, href }: { text: string; href: string | null }) {
  let content;
  if (href === "modal:sign-in") {
    content = (
      <SiteModalButton modal="signIn" className={`${barClasses} w-full hover:underline`}>
        {text}
      </SiteModalButton>
    );
  } else if (href === "modal:track-order") {
    content = (
      <SiteModalButton modal="trackOrder" className={`${barClasses} w-full hover:underline`}>
        {text}
      </SiteModalButton>
    );
  } else if (href) {
    content = (
      <Link href={href} className={`${barClasses} hover:underline`}>
        {text}
      </Link>
    );
  } else {
    content = <p className={barClasses}>{text}</p>;
  }
  return (
    <div role="region" aria-label={copy.label} className="bg-teal">
      {content}
    </div>
  );
}
