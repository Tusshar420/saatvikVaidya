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
import { cartCount } from "@/server/cart/cart";
import { coinSummary } from "@/server/coins/ledger";
import { db } from "@/server/db";
import { currentCartOwner } from "@/server/cart/request";

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
    bagCount,
    coinRules,
  ] = await Promise.all([
    getSetting("contact.phone"),
    getSetting("contact.supportNote"),
    getSetting("search.popular"),
    getSetting("footer.tagline"),
    getSignUpUserTypes(),
    getSession(),
    getEnabledSectionKeys(),
    currentCartOwner().then(cartCount),
    getSetting("coins.rules"),
  ]);
  const coinBalance =
    session && coinRules.enabled ? (await coinSummary(db, session.user.id)).balance : null;

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
        // The ledger balance when signed in; no pill when signed out or the programme is off
        coinBalance={coinBalance}
        bagCount={bagCount}
      />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer tagline={tagline} supportNote={supportNote} phone={phone} />
      <MobileDock />
    </SiteModalsProvider>
  );
}
