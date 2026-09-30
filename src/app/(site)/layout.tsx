import type { ReactNode } from "react";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { MobileDock } from "@/components/site/mobile-dock";
import { SiteModalsProvider } from "@/components/site/site-modals";
import { SkipLink } from "@/components/site/skip-link";
import { navItems } from "@/content/shell";
import { getSetting } from "@/server/content/settings";

// Every public page: skip link, header with nav rail, footer, and the dock on
// phones. The /design showcase sits outside this group on purpose.
export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [phone, supportNote, popularSearches, tagline] = await Promise.all([
    getSetting("contact.phone"),
    getSetting("contact.supportNote"),
    getSetting("search.popular"),
    getSetting("footer.tagline"),
  ]);

  return (
    <SiteModalsProvider phone={phone}>
      <SkipLink />
      <Header
        popularSearches={popularSearches}
        phone={phone}
        navItems={navItems}
        // No accounts, cart or coins yet: A6/A8 pass real values (and null
        // coins when signed out).
        coinBalance={0}
        bagCount={0}
      />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer tagline={tagline} supportNote={supportNote} phone={phone} />
      <MobileDock />
    </SiteModalsProvider>
  );
}
