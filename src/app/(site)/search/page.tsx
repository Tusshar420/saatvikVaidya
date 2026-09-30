import type { Metadata } from "next";
import { Search } from "lucide-react";
import { z } from "zod";
import { ComingSoonPage } from "@/components/site/coming-soon-page";
import { comingSoonPages } from "@/content/pages";
import { getSetting } from "@/server/content/settings";

const copy = comingSoonPages.search;

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false },
};

// `q` comes from the URL: one short, trimmed string, or it is ignored.
const querySchema = z.object({
  q: z.string().trim().min(1).max(100).optional().catch(undefined),
});

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const { q } = querySchema.parse(await searchParams);
  return (
    <ComingSoonPage
      copy={copy}
      icon={<Search aria-hidden />}
      phone={await getSetting("contact.phone")}
      lead={q ? copy.query(q) : undefined}
    />
  );
}
