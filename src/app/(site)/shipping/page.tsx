import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/policy-page";
import { policyPages } from "@/content/pages";
import { getSetting } from "@/server/content/settings";

const copy = policyPages.shipping;

export const metadata: Metadata = { title: copy.metaTitle };

export default async function ShippingPage() {
  return (
    <PolicyPage
      copy={copy}
      href="/shipping"
      phone={await getSetting("contact.phone")}
    />
  );
}
