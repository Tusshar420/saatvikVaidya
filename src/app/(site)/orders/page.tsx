import type { Metadata } from "next";
import { Package } from "lucide-react";
import { ComingSoonPage } from "@/components/site/coming-soon-page";
import { comingSoonPages } from "@/content/pages";
import { getSetting } from "@/server/content/settings";

const copy = comingSoonPages.orders;

export const metadata: Metadata = { title: copy.metaTitle };

export default async function OrdersPage() {
  return (
    <ComingSoonPage
      copy={copy}
      icon={<Package aria-hidden />}
      phone={await getSetting("contact.phone")}
    />
  );
}
