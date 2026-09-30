import type { ReactNode } from "react";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { MobileDock } from "@/components/site/mobile-dock";
import { SiteModalsProvider } from "@/components/site/site-modals";
import { SkipLink } from "@/components/site/skip-link";
import { navItems } from "@/content/shell";
import { getSetting } from "@/server/content/settings";
import { getEnabledSectionKeys } from "@/server/content/home";
import { getSignUpUserTypes } from "@/server/content/user-types";
import { isDevOtpVisible } from "@/server/env";
import { getSession } from "@/server/auth/session";

// Every public page: skip link, header with nav rail, footer, and the dock on
// phones. The /design showcase sits outside this group on purpose.
export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [
    phone,
    supportNote,
    popularSearches,
    tagline,
    userTypes,
    session,
    enabledSections,
  ] = await Promise.all([
    getSetting("contact.phone"),
    getSetting("contact.supportNote"),
    getSetting("search.popular"),
    getSetting("footer.tagline"),
    getSignUpUserTypes(),
    getSession(),
    getEnabledSectionKeys(),
  ]);

  const filteredNavItems = navItems.filter((item) =>
    enabledSections.includes(item.id),
  );

  return (
    <SiteModalsProvider
      phone={phone}
      userTypes={userTypes}
      // Always false in a production build (pages are prerendered with
      // NODE_ENV=production); on `pnpm dev` it follows DEV_SHOW_OTP.
      devShowOtp={isDevOtpVisible()}
    >
      <SkipLink />
      <Header
        popularSearches={popularSearches}
        phone={phone}
        navItems={filteredNavItems}
        // When signed in, show 0 coins; when signed out, hide the pill
        coinBalance={session ? 0 : null}
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
