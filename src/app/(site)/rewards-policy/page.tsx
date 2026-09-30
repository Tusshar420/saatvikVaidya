import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/policy-page";
import { policyPages } from "@/content/pages";
import { getSetting } from "@/server/content/settings";

const copy = policyPages.rewards;

export const metadata: Metadata = { title: copy.metaTitle };

export default async function RewardsPolicyPage() {
  return (
    <PolicyPage
      copy={copy}
      href="/rewards-policy"
      phone={await getSetting("contact.phone")}
    />
  );
}
