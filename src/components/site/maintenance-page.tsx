import { Phone } from "lucide-react";
import { Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { comingSoon as soonCopy, maintenance as copy } from "@/content/maintenance";
import { telHref } from "@/lib/phone";
import { Logo } from "./logo";
import { SiteModalButton } from "./site-modals";

/**
 * What every visitor sees in maintenance mode (admins see the site). No
 * header or navigation: nothing else works. Sign-in stays reachable so an
 * admin can come in, and the support number is there for anything urgent.
 * `comingSoon` swaps the wording for the live site before launch.
 */
export function MaintenancePage({
  message,
  phone,
  comingSoon = false,
}: {
  message: string;
  phone: string;
  comingSoon?: boolean;
}) {
  const words = comingSoon ? soonCopy : { ...copy, message };
  return (
    <main
      id="main"
      tabIndex={-1}
      className="shell flex min-h-dvh flex-col items-center justify-center gap-6 py-12 text-center focus:outline-none"
    >
      <Logo />
      <div className="max-w-xl">
        <Eyebrow>{words.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h1 text-ink">
          {words.title} <em className="text-orange-title not-italic">{words.titleEmphasis}</em>
        </h1>
        <p className="mt-4 text-muted">{words.message}</p>
      </div>
      <a href={telHref(phone)} className={buttonClasses({ variant: "secondary" })}>
        <Phone aria-hidden className="size-4.5" />
        {copy.callLine} {phone}
      </a>
      <SiteModalButton modal="signIn" className="min-h-11 text-small font-bold text-muted underline-offset-4 hover:text-brand hover:underline">
        {copy.adminSignIn}
      </SiteModalButton>
    </main>
  );
}
