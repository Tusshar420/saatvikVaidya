import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, BookOpen, ChevronRight, Coins, GraduationCap, LayoutDashboard, Presentation, LifeBuoy, MapPin, Package, Tag, Phone, ShieldCheck, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { NameForm, NotificationsForm, PasswordForm, TestEmailButton, VerifyEmailButton } from "@/components/site/account/profile-forms";
import { FormAlert } from "@/components/site/auth/form-alert";
import { DocumentUpload } from "@/components/site/account/document-upload";
import { MyEbooks } from "@/components/site/ebooks/my-ebooks";
import { listOwnedEbooks } from "@/server/ebooks/ebooks";
import { SignOutButton } from "@/components/site/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { ButtonArrow } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { account as copy } from "@/content/account";
import { courses as coursesCopy } from "@/content/courses";
import { verification as documents } from "@/content/verification";
import { signInPath } from "@/lib/auth-routes";
import { courseHref, doctorCoursesPath } from "@/lib/courses";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber, initialsOf } from "@/lib/format";
import { formatIndianPhone, telHref } from "@/lib/phone";
import { readAccount } from "@/server/auth/account";
import { getSession } from "@/server/auth/session";
import { GuestAccount } from "@/components/site/account/guest-account";
import { getSetting } from "@/server/content/settings";
import { coinSummary } from "@/server/coins/ledger";
import { listMyEnrolments, userCanTeach, type MyCourse } from "@/server/courses/courses";
import { db } from "@/server/db";
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
  none: "brand",
  pending: "orange",
  approved: "brand",
  rejected: "orange",
} as const;

/**
 * The signed-in user's profile: name, contact, user type and professional
 * verification status. Professionals whose type needs verification also get
 * their document uploads here. Visitors who aren't signed in get the guest view with a
 * sign-in prompt (the proxy leaves this exact path open on purpose).
 */
export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const session = await getSession();
  if (!session) return <GuestAccount phone={await getSetting("contact.phone")} />;
  const { user } = session;
  const justVerified = (await searchParams).emailVerified === "1";
  const [profile, phone, professional] = await Promise.all([
    readAccount(user.id),
    getSetting("contact.phone"),
    readProfessionalVerification(user.id),
  ]);
  const [ebooks, myCourses, teacher] = await Promise.all([
    listOwnedEbooks({ id: user.id, role: user.role ?? "user" }),
    listMyEnrolments(user.id),
    userCanTeach(user.id),
  ]);
  if (!profile) redirect(signInPath("/account"));

  const status = copy.status[profile.verificationStatus];
  const [activeOrders, wallet] = await Promise.all([
    db.order.count({ where: { userId: user.id, status: { in: ["paid", "processing", "shipped"] } } }),
    coinSummary(db, user.id),
  ]);
  // Completion: the steps a member can take on this page, each worth the same.
  const steps = [
    true,
    profile.phoneNumber !== null && profile.phoneNumberVerified,
    profile.email !== null && profile.emailVerified,
    profile.verificationStatus === "approved" || profile.verificationStatus === "none",
  ];
  const completion = Math.round((steps.filter(Boolean).length / steps.length) * 100);

  return (
    <>
      <PageHero
        eyebrow={copy.hero.eyebrow}
        title={copy.hero.title}
        titleAs="p"
        description={copy.hero.description}
        note={{ status: copy.hero.status, title: copy.hero.noteTitle, text: copy.hero.noteText }}
      />

      <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
        <div className="shell grid items-start gap-5.5 md:grid-cols-[310px_minmax(0,1fr)]">
          <aside className={cn(cardClass, "p-5 sm:p-6.25 md:sticky md:top-28")}>
            <span
              aria-hidden
              className="grid size-17.5 place-items-center rounded-[20px] bg-avatar font-heading text-[20px] font-extrabold text-white"
            >
              {initialsOf(profile.name)}
            </span>
            <h1 className="mt-3.75 font-heading text-[21px] leading-tight font-extrabold tracking-[-0.02em] break-words text-ink">
              {profile.name}
            </h1>
            <p className="mt-0.75 text-small text-muted">
              {profile.userTypeLabel}
              {/* Email-only accounts have no mobile to verify. */}
              {profile.phoneNumber !== null &&
                ` · ${profile.phoneNumberVerified ? copy.summary.mobileVerified : copy.summary.mobileNotVerified}`}
            </p>
            <div className="my-5.5 rounded-md bg-surface-alt p-3.75">
              <div className="flex justify-between text-small font-extrabold text-ink">
                <span>{copy.summary.completion}</span>
                <span>{completion}%</span>
              </div>
              <div
                role="progressbar"
                aria-label={copy.summary.completionLabel(completion)}
                aria-valuenow={completion}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2.25 h-1.5 overflow-hidden rounded-full bg-track"
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${completion}%` }} />
              </div>
            </div>
            <Shortcuts isAdmin={user.role === "admin"} teacher={teacher} />
            <SignOutButton className="mt-4 w-full" />
          </aside>

          <div id="overview" className="flex min-w-0 scroll-mt-28 flex-col gap-3.25">
            {justVerified && profile.emailVerified && (
              <FormAlert tone="success">{copy.emailVerify.justVerified}</FormAlert>
            )}

            <div className="grid gap-3.25 sm:grid-cols-2">
              <StatCard
                eyebrow={copy.dashboard.ordersEyebrow}
                title={copy.dashboard.ordersTitle}
                text={copy.dashboard.ordersText}
                stat={formatNumber(activeOrders)}
                href="/orders"
                link={copy.dashboard.ordersLink}
              />
              <StatCard
                eyebrow={copy.dashboard.coinsEyebrow}
                title={copy.dashboard.coinsTitle}
                text={copy.dashboard.coinsText}
                stat={formatNumber(wallet.balance)}
                href="/coins"
                link={copy.dashboard.coinsLink}
              />
            </div>

            <section aria-labelledby="account-details" className={cn(cardClass, "p-5 sm:p-5.25")}>
              <CardEyebrow>{copy.dashboard.detailsEyebrow}</CardEyebrow>
              <h2 id="account-details" className={cardTitle}>
                {copy.detailsTitle}
              </h2>
              <dl className="mt-4 grid gap-3.5 text-sm sm:grid-cols-2">
                <Row label={copy.name}>{profile.name}</Row>
                <Row label={copy.userType}>{profile.userTypeLabel}</Row>
                <Row label={copy.mobile}>
                  {profile.phoneNumber ? (
                    <Contact value={formatIndianPhone(profile.phoneNumber)} verified={profile.phoneNumberVerified} />
                  ) : (
                    <span className="text-muted">{copy.notAdded}</span>
                  )}
                </Row>
                <Row label={copy.email}>
                  {profile.email ? (
                    <>
                      <Contact value={profile.email} verified={profile.emailVerified} />
                      {!profile.emailVerified && <VerifyEmailButton />}
                      <TestEmailButton />
                    </>
                  ) : (
                    <span className="text-muted">{copy.notAdded}</span>
                  )}
                </Row>
              </dl>
              <div className="mt-5 border-t border-line pt-5">
                <NameForm name={profile.name} />
              </div>
            </section>

            <section aria-labelledby="account-status" className={cn(cardClass, "scroll-mt-28 p-5 sm:p-5.25")}>
              <CardEyebrow>{copy.dashboard.statusEyebrow}</CardEyebrow>
              <h2 id="account-status" className={cardTitle}>
                {copy.statusTitle}
              </h2>
              {professional ? (
                <ProfessionalStatus verification={professional} phone={phone} />
              ) : (
                <>
                  <Badge variant={statusBadge[profile.verificationStatus]} className="mt-3">
                    {status.badge}
                  </Badge>
                  <p className="mt-3 text-sm text-ink">{status.text}</p>
                  {profile.verificationStatus === "rejected" && <CallUs phone={phone} />}
                </>
              )}
            </section>

            {professional && <Documents verification={professional} />}

            <div className="grid gap-3.25 sm:grid-cols-2">
              <LinkCard
                eyebrow={copy.dashboard.learningEyebrow}
                title={copy.dashboard.learningTitle}
                text={copy.dashboard.learningText}
                href="/courses"
                link={copy.dashboard.learningLink}
              />
              <LinkCard
                eyebrow={copy.dashboard.communityEyebrow}
                title={copy.dashboard.communityTitle}
                text={copy.dashboard.communityText}
                href="/doctor-talk"
                link={copy.dashboard.communityLink}
              />
            </div>

            <MyEbooks ebooks={ebooks} className="scroll-mt-28 p-5 max-sm:rounded-lg sm:p-5.25" />

            <MyCourses courses={myCourses} />

            <div className="grid gap-3.25 lg:grid-cols-2">
              <section aria-labelledby="account-password-title" className={cn(cardClass, "p-5 sm:p-5.25")}>
                {profile.hasPassword ? (
                  <PasswordForm />
                ) : (
                  <>
                    <h2 id="account-password-title" className={cardTitle}>
                      {copy.password.title}
                    </h2>
                    <p className="mt-3 text-sm text-muted">{copy.password.none}</p>
                  </>
                )}
              </section>
              <section aria-labelledby="account-notifications-title" className={cn(cardClass, "p-5 sm:p-5.25")}>
                <NotificationsForm
                  initial={{
                    notifyOrderSms: profile.notifyOrderSms,
                    notifyOrderEmail: profile.notifyOrderEmail,
                    marketingOptIn: profile.marketingOptIn,
                  }}
                  hasEmail={profile.email !== null}
                  hasPhone={profile.phoneNumber !== null}
                />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const cardClass = "rounded-xl border border-line bg-surface shadow-card max-sm:rounded-lg";

/** "My courses" (B1): the courses this member enrolled in. */
function MyCourses({ courses }: { courses: MyCourse[] }) {
  const text = coursesCopy.account;
  return (
    <section
      id="account-courses"
      aria-labelledby="account-courses-title"
      className={cn(cardClass, "scroll-mt-28 p-5 sm:p-5.25")}
    >
      <h2 id="account-courses-title" className={cardTitle}>
        {text.title}
      </h2>
      {courses.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {text.empty}{" "}
          <Link href="/courses" className="font-bold text-brand underline-offset-4 hover:underline">
            {text.browse}
          </Link>
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {courses.map((course) => (
            <li
              key={course.key}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-3 first:border-t-0"
            >
              <span className="min-w-0">
                <span className="block font-bold break-words text-ink">{course.title}</span>
                <span className="text-small text-muted">{text.enrolledOn(formatDate(course.enrolledAt))}</span>
              </span>
              <Link
                href={courseHref(course.key)}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand hover:underline"
              >
                {text.open}
                <ButtonArrow />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
const cardTitle = "mt-1.5 font-heading text-h4 text-ink";

function CardEyebrow({ children }: { children: ReactNode }) {
  return <p className="font-heading text-label text-orange-ink uppercase">{children}</p>;
}

/** A v2 dashboard card with a big number (`.dashboard-card` + `.dashboard-stat`). */
function StatCard({
  eyebrow,
  title,
  text,
  stat,
  href,
  link,
}: {
  eyebrow: string;
  title: string;
  text: string;
  stat: string;
  href: string;
  link: string;
}) {
  return (
    <section className={cn(cardClass, "flex flex-col p-5 sm:p-5.25")}>
      <CardEyebrow>{eyebrow}</CardEyebrow>
      <h2 className={cardTitle}>{title}</h2>
      <p className="mt-1.25 text-small text-muted">{text}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="font-heading text-[27px] leading-none font-extrabold text-brand tabular-nums">{stat}</p>
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand hover:underline">
          {link}
          <ButtonArrow />
        </Link>
      </div>
    </section>
  );
}

/** A dashboard card that leads to another part of the site. */
function LinkCard({ eyebrow, title, text, href, link }: { eyebrow: string; title: string; text: string; href: string; link: string }) {
  return (
    <section className={cn(cardClass, "p-5 sm:p-5.25")}>
      <CardEyebrow>{eyebrow}</CardEyebrow>
      <h2 className={cardTitle}>{title}</h2>
      <p className="mt-1.25 text-small text-muted">{text}</p>
      <Link href={href} className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand hover:underline">
        {link}
        <ButtonArrow />
      </Link>
    </section>
  );
}

type ShortcutLink = { href: string; icon: LucideIcon; text: { label: string; help: string } };

const shortcutLinks: ShortcutLink[] = [
  { href: "/orders", icon: Package, text: copy.shortcuts.orders },
  // Branded orders aren't in Orders & Requests; this is their way back.
  { href: "/my-brand", icon: Sparkles, text: copy.shortcuts.brandOrders },
  { href: "/coins", icon: Coins, text: copy.shortcuts.coins },
  { href: "/account#account-ebooks", icon: BookOpen, text: copy.shortcuts.ebooks },
  { href: "/account#account-courses", icon: GraduationCap, text: coursesCopy.account.shortcut },
  { href: "/account/addresses", icon: MapPin, text: copy.shortcuts.addresses },
  { href: "/account/brands", icon: Tag, text: copy.shortcuts.brands },
  { href: "/account#account-status", icon: ShieldCheck, text: copy.shortcuts.verification },
  { href: "/account/reports", icon: LifeBuoy, text: copy.shortcuts.reports },
];

const adminLink: ShortcutLink = { href: "/admin", icon: LayoutDashboard, text: copy.shortcuts.admin };
const teachLink: ShortcutLink = { href: doctorCoursesPath, icon: Presentation, text: coursesCopy.account.teachShortcut };

/**
 * Links to the rest of the signed-in area. Admins also get a link to the
 * admin panel, which checks their role and two-factor itself; approved
 * doctors get their course area (B2).
 */
function Shortcuts({ isAdmin, teacher }: { isAdmin: boolean; teacher: boolean }) {
  const links = [...(isAdmin ? [adminLink] : []), ...(teacher ? [teachLink] : []), ...shortcutLinks];
  return (
    <nav aria-label={copy.shortcuts.title}>
      <ul className="flex flex-col">
        <li>
          <Link
            href="/account#overview"
            aria-current="page"
            className="flex min-h-11 items-center gap-3 border-t border-line px-0.5 py-2.5 text-sm font-extrabold text-brand"
          >
            <UserRound aria-hidden className="size-4.5 shrink-0" />
            {copy.shortcuts.overview}
          </Link>
        </li>
        {links.map(({ href, icon: Icon, text }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex min-h-11 items-center gap-3 border-t border-line px-0.5 py-2.5 text-sm font-bold text-muted transition hover:text-brand"
            >
              <Icon aria-hidden className="size-4.5 shrink-0" />
              <span className="min-w-0 flex-1">{text.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
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
  approved: "brand",
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
      <Badge variant={stateBadge[verification.state]} className="mt-3">
        {state.badge}
      </Badge>
      <p className="mt-3 text-sm text-ink">{state.text}</p>
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
    <Card as="section" aria-labelledby="account-documents" className="p-5 shadow-card max-sm:rounded-lg sm:p-5.25">
      <h2 id="account-documents" className="font-heading text-h4 text-ink">
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
      className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand underline-offset-4 hover:underline"
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
            ? "inline-flex items-center gap-1 text-small font-bold text-brand [&_svg]:text-success"
            : "text-small font-medium text-muted"
        }
      >
        {verified && <BadgeCheck aria-hidden className="size-4" />}
        {verified ? copy.verified : copy.notVerified}
      </span>
    </span>
  );
}
