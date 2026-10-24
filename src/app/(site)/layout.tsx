import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { MaintenancePage } from "@/components/site/maintenance-page";
import { MobileDock } from "@/components/site/mobile-dock";
import { StickyActions } from "@/components/site/sticky-actions";
import { SiteModalsProvider } from "@/components/site/site-modals";
import { SkipLink } from "@/components/site/skip-link";
import { shell } from "@/content/shell";
import { formatNumber } from "@/lib/format";
import { getSetting } from "@/server/content/settings";
import { getSignUpUserTypes } from "@/server/content/user-types";
import { isDevOtpVisible } from "@/server/env";
import { getSession } from "@/server/auth/session";
import { cartCount } from "@/server/cart/cart";
import { currentCartOwner } from "@/server/cart/request";
import { unreadBySection, unreadCount } from "@/server/notifications/notifications";

// Every public page: skip link, header with nav rail, footer, and the dock on
// phones. The /design showcase sits outside this group on purpose.
export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [
    phone,
    popularSearches,
    tagline,
    userTypes,
    session,
    bagCount,
    coinRules,
    maintenance,
    announcement,
  ] = await Promise.all([
    getSetting("contact.phone"),
    getSetting("search.popular"),
    getSetting("footer.tagline"),
    getSignUpUserTypes(),
    getSession(),
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
  const [notificationCount, sectionBadges] = session
    ? await Promise.all([unreadCount(session.user.id), unreadBySection(session.user.id)])
    : [0, {}];
  // The orange bar: the admin's announcement when it's on, otherwise the
  // Saatvik Coins message built from the coin rules (U.4).
  const bar =
    announcement.enabled && announcement.text
      ? { text: announcement.text, href: announcement.href }
      : coinRules.enabled
        ? {
            text: shell.announcement.earn(
              formatNumber(10_000),
              formatNumber(coinRules.earnPerThousandRupees * 10),
            ),
            detail: `${shell.announcement.rate(formatNumber(coinRules.coinsPerRupee))} · ${shell.announcement.validity(coinRules.expiryMonths)}`,
            href: "/coins",
            linkLabel: shell.announcement.cta,
          }
        : null;

  return (
    <SiteModalsProvider
      phone={phone}
      userTypes={userTypes}
      // Always false in a production build (pages are prerendered with
      // NODE_ENV=production); on `pnpm dev` it follows DEV_SHOW_OTP.
      devShowOtp={isDevOtpVisible()}
    >
      <SkipLink />
      {bar && <AnnouncementBar {...bar} />}
      <Header
        popularSearches={popularSearches}
        bagCount={bagCount}
        notificationCount={notificationCount}
        sectionBadges={sectionBadges}
      />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer tagline={tagline} phone={phone} />
      <StickyActions phone={phone} />
      <MobileDock />
    </SiteModalsProvider>
  );
}
