import type { Metadata } from "next";
import { FeedbackGallery } from "@/components/site/feedback/feedback-gallery";
import { PageHero, PortalShell } from "@/components/site/portal/page-hero";
import { portalPages } from "@/content/portal-pages";
import { getFeedbackContent } from "@/server/content/pages";

const copy = portalPages.feedback;

export const metadata: Metadata = { title: copy.metaTitle };

/** Real Feedback (U.13): the published Feedback rows, originals in a modal. */
export default async function FeedbackPage() {
  const items = await getFeedbackContent();
  return (
    <>
      <PageHero copy={copy.hero} />
      <PortalShell>
        <FeedbackGallery items={items} />
      </PortalShell>
    </>
  );
}
