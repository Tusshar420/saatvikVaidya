import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/not-found-screen";
import { notFoundScreen } from "@/content/errors";

export const metadata: Metadata = { title: notFoundScreen.metaTitle };

// A missing product or ebook: shown inside the site's header and footer.
export default function SiteNotFound() {
  return <NotFoundScreen />;
}
