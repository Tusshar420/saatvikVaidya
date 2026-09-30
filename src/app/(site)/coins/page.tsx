import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { ComingSoonPage } from "@/components/site/coming-soon-page";
import { comingSoonPages } from "@/content/pages";
import { getSetting } from "@/server/content/settings";

const copy = comingSoonPages.coins;

export const metadata: Metadata = { title: copy.metaTitle };

export default async function CoinsPage() {
  return (
    <ComingSoonPage
      copy={copy}
      icon={<Coins aria-hidden />}
      phone={await getSetting("contact.phone")}
    />
  );
}
