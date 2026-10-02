import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { MaintenancePage } from "@/components/site/maintenance-page";
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
    maintenance,
    announcement,
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
    getSetting("site.maintenance"),
    getSetting("site.announcement"),
  ]);
  // Maintenance mode: everyone but signed-in admins gets the branded page.
  // Sign-in stays open (the modal, and /api/auth, which isn't under this
  // layout) so an admin can come in.
  if (maintenance.enabled && session?.user.role !== "admin") {
    return (
      <SiteModalsProvider
        phone={phone}
        userTypes={userTypes}
        devShowOtp={isDevOtpVisible()}
      >
        <MaintenancePage message={maintenance.message} phone={phone} />
      </SiteModalsProvider>
    );
  }
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
      {announcement.enabled && announcement.text && (
        <AnnouncementBar text={announcement.text} href={announcement.href} />
      )}
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
