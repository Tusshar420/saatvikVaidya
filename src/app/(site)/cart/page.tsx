import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { ComingSoonPage } from "@/components/site/coming-soon-page";
import { comingSoonPages } from "@/content/pages";
import { getSetting } from "@/server/content/settings";

const copy = comingSoonPages.cart;

export const metadata: Metadata = { title: copy.metaTitle };

export default async function CartPage() {
  return (
    <ComingSoonPage
      copy={copy}
      icon={<ShoppingBag aria-hidden />}
      phone={await getSetting("contact.phone")}
    />
  );
}
