import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, BookOpen, ChevronRight, Coins, LayoutDashboard, MapPin, Package, Tag, Phone, ShieldCheck, type LucideIcon } from "lucide-react";
import { NameForm, NotificationsForm, PasswordForm, VerifyEmailButton } from "@/components/site/account/profile-forms";
import { FormAlert } from "@/components/site/auth/form-alert";
import { DocumentUpload } from "@/components/site/account/document-upload";
import { MyEbooks } from "@/components/site/ebooks/my-ebooks";
import { listOwnedEbooks } from "@/server/ebooks/ebooks";
import { SignOutButton } from "@/components/site/auth/sign-out-button";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { account as copy } from "@/content/account";
import { verification as documents } from "@/content/verification";
import { signInPath } from "@/lib/auth-routes";
import { formatDate } from "@/lib/format";
import { formatIndianPhone, telHref } from "@/lib/phone";
import { readAccount } from "@/server/auth/account";
import { requireUser } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";
import {
  readProfessionalVerification,
  type ProfessionalVerification,
} from "@/server/verification/documents";
import { documentUpload, formatFileSize } from "@/lib/verification";

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
 * verification status. Professionals whose type needs verification also get
 * their document uploads here. Protected: the proxy sends visitors without a session
 * cookie to sign-in, and requireUser() checks the session itself.
 */
export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const { user } = await requireUser("/account");
  const justVerified = (await searchParams).emailVerified === "1";
  const [profile, phone, professional] = await Promise.all([
    readAccount(user.id),
    getSetting("contact.phone"),
    readProfessionalVerification(user.id),
  ]);
  const ebooks = await listOwnedEbooks({ id: user.id, role: user.role ?? "user" });
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

        {justVerified && profile.emailVerified && (
          <FormAlert tone="success" className="mt-6">
            {copy.emailVerify.justVerified}
          </FormAlert>
        )}

        <Shortcuts isAdmin={user.role === "admin"} />

        <div className="mt-5 grid gap-5 md:grid-cols-2">
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
                  <>
                    <Contact
                      value={profile.email}
                      verified={profile.emailVerified}
                    />
                    {!profile.emailVerified && <VerifyEmailButton />}
                  </>
                ) : (
                  <span className="text-muted">{copy.notAdded}</span>
                )}
              </Row>
              <Row label={copy.userType}>{profile.userTypeLabel}</Row>
            </dl>
            <div className="mt-5 border-t border-line pt-5">
              <NameForm name={profile.name} />
            </div>
          </Card>

          <Card as="section" aria-labelledby="account-status">
            <h2 id="account-status" className="text-h3 text-ink">
              {copy.statusTitle}
            </h2>
            {professional ? (
              <ProfessionalStatus verification={professional} phone={phone} />
            ) : (
              <>
                <Badge
                  variant={statusBadge[profile.verificationStatus]}
                  className="mt-4"
                >
                  {status.badge}
                </Badge>
                <p className="mt-3 text-body text-ink">{status.text}</p>
                {profile.verificationStatus === "rejected" && (
                  <CallUs phone={phone} />
                )}
              </>
            )}
          </Card>
        </div>

        {professional && <Documents verification={professional} />}

        <MyEbooks ebooks={ebooks} />

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Card as="section" aria-labelledby="account-password-title">
            {profile.hasPassword ? (
              <PasswordForm />
            ) : (
              <>
                <h2 id="account-password-title" className="text-h3 text-ink">
                  {copy.password.title}
                </h2>
                <p className="mt-3 text-sm text-muted">{copy.password.none}</p>
              </>
            )}
          </Card>
          <Card as="section" aria-labelledby="account-notifications-title">
            <NotificationsForm
              initial={{
                notifyOrderSms: profile.notifyOrderSms,
                notifyOrderEmail: profile.notifyOrderEmail,
                marketingOptIn: profile.marketingOptIn,
              }}
              hasEmail={profile.email !== null}
              hasPhone={profile.phoneNumber !== null}
            />
          </Card>
        </div>

        <SignOutButton className="mt-8 max-sm:w-full" />
      </div>
    </div>
  );
}

type ShortcutLink = { href: string; icon: LucideIcon; text: { label: string; help: string } };

const shortcutLinks: ShortcutLink[] = [
  { href: "/orders", icon: Package, text: copy.shortcuts.orders },
  { href: "/coins", icon: Coins, text: copy.shortcuts.coins },
  { href: "/account#account-ebooks", icon: BookOpen, text: copy.shortcuts.ebooks },
  { href: "/account/addresses", icon: MapPin, text: copy.shortcuts.addresses },
  { href: "/account/brands", icon: Tag, text: copy.shortcuts.brands },
  { href: "/account#account-status", icon: ShieldCheck, text: copy.shortcuts.verification },
];

const adminLink: ShortcutLink = { href: "/admin", icon: LayoutDashboard, text: copy.shortcuts.admin };

/**
 * Links to the rest of the signed-in area. Admins also get a link to the
 * admin panel, which checks their role and two-factor itself.
 */
function Shortcuts({ isAdmin }: { isAdmin: boolean }) {
  const links = isAdmin ? [adminLink, ...shortcutLinks] : shortcutLinks;
  return (
    <nav aria-label={copy.shortcuts.title} className="mt-8">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, icon: Icon, text }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface p-3.5 transition hover:border-teal"
            >
              <Icon aria-hidden className="size-5 shrink-0 text-teal" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-ink">{text.label}</span>
                <span className="block text-small text-muted">{text.help}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const stateBadge = {
  needed: "orange",
  review: "orange",
  approved: "teal",
  rejected: "live",
} as const;

/** The status card for professionals: where they are, and what's next. */
function ProfessionalStatus({
  verification,
  phone,
}: {
  verification: ProfessionalVerification;
  phone: string;
}) {
  const state = documents.state[verification.state];
  return (
    <>
      <Badge variant={stateBadge[verification.state]} className="mt-4">
        {state.badge}
      </Badge>
      <p className="mt-3 text-body text-ink">{state.text}</p>
      {verification.state === "review" && verification.submittedAt && (
        <p className="mt-2 text-small font-semibold text-muted">
          {documents.submittedOn(formatDate(verification.submittedAt))}
        </p>
      )}
      {verification.rejection && (
        <>
          <div className="mt-4 rounded-md bg-danger-soft p-3.5">
            <p className="text-small font-extrabold text-danger">
              {documents.reasonTitle}
            </p>
            <p className="mt-1 text-sm break-words text-ink">
              {verification.rejection.comment ?? documents.noReason}
            </p>
          </div>
          <p className="mt-3 text-sm text-ink">{documents.reuploadPrompt}</p>
          <CallUs phone={phone} />
        </>
      )}
    </>
  );
}

/** Upload cards for each required document. */
function Documents({ verification }: { verification: ProfessionalVerification }) {
  const locked = verification.status === "approved";
  const byType = new Map(
    verification.documents.map((document) => [document.documentType, document]),
  );
  return (
    <Card as="section" aria-labelledby="account-documents" className="mt-5">
      <h2 id="account-documents" className="text-h3 text-ink">
        {documents.documentsTitle}
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        {locked
          ? documents.documentsLocked
          : documents.documentsIntro(formatFileSize(documentUpload.maxBytes))}
      </p>
      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        {verification.required.map((type) => {
          const document = byType.get(type);
          return (
            <DocumentUpload
              key={type}
              documentType={type}
              locked={locked}
              current={
                document
                  ? {
                      id: document.id,
                      fileName: document.fileName,
                      contentType: document.contentType,
                      sizeBytes: document.sizeBytes,
                      uploadedOn: formatDate(document.uploadedAt),
                      verified: document.verifiedAt !== null,
                    }
                  : null
              }
            />
          );
        })}
      </ul>
    </Card>
  );
}

function CallUs({ phone }: { phone: string }) {
  return (
    <a
      href={telHref(phone)}
      className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal underline-offset-4 hover:underline"
    >
      <Phone aria-hidden className="size-4" />
      {copy.call(phone)}
    </a>
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
