import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, Phone } from "lucide-react";
import { SignOutButton } from "@/components/site/auth/sign-out-button";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { account as copy } from "@/content/account";
import { signInPath } from "@/lib/auth-routes";
import { formatIndianPhone, telHref } from "@/lib/phone";
import { readAccount } from "@/server/auth/account";
import { requireUser } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

const statusBadge = {
  none: "teal",
  pending: "orange",
  approved: "teal",
  rejected: "orange",
} as const;

/**
 * The signed-in user's profile: name, contact, user type and professional
 * verification status. Protected: the proxy sends visitors without a session
 * cookie to sign-in, and requireUser() checks the session itself.
 */
export default async function AccountPage() {
  const { user } = await requireUser("/account");
  const [profile, phone] = await Promise.all([
    readAccount(user.id),
    getSetting("contact.phone"),
  ]);
  if (!profile) redirect(signInPath("/account"));

  const status = copy.status[profile.verificationStatus];

  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">
          {copy.title(profile.name)}{" "}
          <em className="block text-teal not-italic">{copy.titleEmphasis}</em>
        </h1>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card as="section" aria-labelledby="account-details">
            <h2 id="account-details" className="text-h3 text-ink">
              {copy.detailsTitle}
            </h2>
            <dl className="mt-4 flex flex-col gap-3.5 text-sm">
              <Row label={copy.name}>{profile.name}</Row>
              <Row label={copy.mobile}>
                {profile.phoneNumber ? (
                  <Contact
                    value={formatIndianPhone(profile.phoneNumber)}
                    verified={profile.phoneNumberVerified}
                  />
                ) : (
                  <span className="text-muted">{copy.notAdded}</span>
                )}
              </Row>
              <Row label={copy.email}>
                {profile.email ? (
                  <Contact
                    value={profile.email}
                    verified={profile.emailVerified}
                  />
                ) : (
                  <span className="text-muted">{copy.notAdded}</span>
                )}
              </Row>
              <Row label={copy.userType}>{profile.userTypeLabel}</Row>
            </dl>
          </Card>

          <Card as="section" aria-labelledby="account-status">
            <h2 id="account-status" className="text-h3 text-ink">
              {copy.statusTitle}
            </h2>
            <Badge
              variant={statusBadge[profile.verificationStatus]}
              className="mt-4"
            >
              {status.badge}
            </Badge>
            <p className="mt-3 text-body text-ink">{status.text}</p>
            {profile.verificationStatus === "rejected" && (
              <a
                href={telHref(phone)}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal underline-offset-4 hover:underline"
              >
                <Phone aria-hidden className="size-4" />
                {copy.call(phone)}
              </a>
            )}
          </Card>
        </div>

        <SignOutButton className="mt-8 max-sm:w-full" />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small font-bold text-muted">{label}</dt>
      <dd className="font-semibold break-words text-ink">{children}</dd>
    </div>
  );
}

function Contact({ value, verified }: { value: string; verified: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {value}
      <span
        className={
          verified
            ? "inline-flex items-center gap-1 text-small font-bold text-teal [&_svg]:text-green"
            : "text-small font-medium text-muted"
        }
      >
        {verified && <BadgeCheck aria-hidden className="size-4" />}
        {verified ? copy.verified : copy.notVerified}
      </span>
    </span>
  );
}
