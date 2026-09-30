import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/policy-page";
import { policyPages } from "@/content/pages";
import { getSetting } from "@/server/content/settings";

const copy = policyPages.terms;

export const metadata: Metadata = { title: copy.metaTitle };

export default async function TermsPage() {
  return (
    <PolicyPage
      copy={copy}
      href="/terms"
      phone={await getSetting("contact.phone")}
    />
  );
}
