import type { Metadata } from "next";
import {
  CallbackCard,
  PathwayCards,
} from "@/components/site/partner/partner-blocks";
import { PageHero, PortalShell } from "@/components/site/portal/page-hero";
import { portalPages } from "@/content/portal-pages";
import { getSetting } from "@/server/content/settings";

const copy = portalPages.partner;

export const metadata: Metadata = { title: copy.metaTitle };

/** Partner & Grow (U.13): pathway cards and the callback request card. */
export default async function PartnerPage() {
  const phone = await getSetting("contact.phone");
  return (
    <>
      <PageHero copy={copy.hero} />
      <PortalShell>
        <PathwayCards />
        <CallbackCard phone={phone} />
      </PortalShell>
    </>
  );
}
