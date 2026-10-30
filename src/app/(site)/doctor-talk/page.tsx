import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MessagesSquare, PlayCircle, ShieldCheck } from "lucide-react";
import { DoctorTalkSidebar } from "@/components/site/doctor-talk/sidebar";
import { ThreadCard } from "@/components/site/doctor-talk/thread-card";
import { ThreadComposer } from "@/components/site/doctor-talk/thread-forms";
import {
  PageHero,
  PortalSectionTitle,
  PortalShell,
  pillClasses,
} from "@/components/site/portal/page-hero";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { signInPath } from "@/lib/auth-routes";
import { isThreadFilter, threadFilters } from "@/lib/threads";
import { portalPages } from "@/content/portal-pages";
import { threads } from "@/content/threads";
import { getSession } from "@/server/auth/session";
import { canWrite, listThreads } from "@/server/threads/threads";

const copy = portalPages.doctorTalk;

export const metadata: Metadata = { title: copy.metaTitle };

/**
 * Dr. Talk: the Thread feed. Signed-in members read and like; verified
 * doctors start threads and reply.
 */
export default async function DoctorTalkPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter = isThreadFilter(rawFilter) ? rawFilter : "latest";
  const session = await getSession();
  const writer = session ? await canWrite(session.user.id) : false;
  const items = session ? await listThreads(session.user.id, filter) : [];

  return (
    <>
      <PageHero copy={copy.hero} />
      <PortalShell>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          <section aria-labelledby="talk-title" className="min-w-0">
            <PortalSectionTitle
              id="talk-title"
              title={copy.title}
              text={copy.intro}
              action={writer ? <ThreadComposer /> : undefined}
            />
            {session ? (
              <>
                <nav aria-label={threads.filtersLabel} className="scrollbar-none mb-5 flex gap-1.5 overflow-x-auto">
                  {threadFilters.map((key) => (
                    <Link
                      key={key}
                      href={key === "latest" ? "/doctor-talk" : `/doctor-talk?filter=${key}`}
                      aria-current={key === filter ? "page" : undefined}
                      className={pillClasses(key === filter)}
                    >
                      {threads.filters[key]}
                    </Link>
                  ))}
                </nav>
                {!writer && <p className="mb-4 text-small text-muted">{threads.readOnlyNote}</p>}
                {items.length === 0 ? (
                  <EmptyState
                    icon={<MessagesSquare aria-hidden />}
                    title={threads.emptyTitle}
                    description={writer ? threads.emptyText : threads.emptyReadOnlyText}
                    className="rounded-xl border-solid border-line bg-surface py-14 shadow-card"
                  />
                ) : (
                  <ul className="grid gap-3.5">
                    {items.map((thread) => (
                      <li key={thread.id}>
                        <ThreadCard thread={thread} canLike />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <EmptyState
                icon={<MessagesSquare aria-hidden />}
                title={threads.signedOutTitle}
                description={threads.signedOutText}
                className="rounded-xl border-solid border-line bg-surface py-14 shadow-card"
                action={
                  <Link href={signInPath("/doctor-talk")} className={buttonClasses({})}>
                    {threads.signIn}
                  </Link>
                }
              />
            )}
          </section>
          <DoctorTalkSidebar
            icons={{
              doctors: <BadgeCheck aria-hidden />,
              standard: <ShieldCheck aria-hidden />,
              talks: <PlayCircle aria-hidden />,
            }}
          />
        </div>
      </PortalShell>
    </>
  );
}
