import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthorLine, LikeButton } from "@/components/site/doctor-talk/thread-card";
import { ReplyForm } from "@/components/site/doctor-talk/thread-forms";
import { PortalShell, portalCardClasses } from "@/components/site/portal/page-hero";
import { Badge } from "@/components/ui/badge";
import { signInPath } from "@/lib/auth-routes";
import { portalPages } from "@/content/portal-pages";
import { threads } from "@/content/threads";
import { getSession } from "@/server/auth/session";
import { canWrite, readThread } from "@/server/threads/threads";

export const metadata: Metadata = { title: portalPages.doctorTalk.metaTitle };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const session = await getSession();
  if (!session) redirect(signInPath(`/doctor-talk/${id}`));
  const found = await readThread(session.user.id, id);
  if (!found) notFound();
  const writer = await canWrite(session.user.id);
  const { thread, replies } = found;

  return (
    <PortalShell>
      <div className="mx-auto max-w-3xl">
        <Link href="/doctor-talk" className="mb-4 inline-flex min-h-11 items-center text-small font-bold text-brand">
          ← {threads.back}
        </Link>
        <article className={`${portalCardClasses} p-6 max-sm:p-4`}>
          <div className="flex items-start justify-between gap-3">
            <AuthorLine author={thread.author} createdAt={thread.createdAt} />
            <Badge>{threads.kindLabel[thread.kind]}</Badge>
          </div>
          <h1 className="mt-4 text-h3 text-ink">{thread.title}</h1>
          <p className="mt-3 text-body-lg whitespace-pre-line text-ink">{thread.body}</p>
          <div className="mt-4 border-t border-line pt-2">
            <LikeButton thread={thread} canLike={writer} />
          </div>
        </article>

        <section aria-labelledby="replies-title" className="mt-6">
          <h2 id="replies-title" className="mb-3 text-h3 text-ink">
            {threads.reply.listLabel} · {threads.reply.count(thread.replyCount)}
          </h2>
          {replies.length === 0 ? (
            <p className="text-small text-muted">{threads.reply.none}</p>
          ) : (
            <ul className="grid gap-3">
              {replies.map((reply) => (
                <li key={reply.id} className={`${portalCardClasses} p-4`}>
                  <AuthorLine author={reply.author} createdAt={reply.createdAt} />
                  <p className="mt-2.5 text-small whitespace-pre-line text-ink">{reply.body}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5">
            {writer ? <ReplyForm threadId={thread.id} /> : <p className="text-small text-muted">{threads.readOnlyNote}</p>}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
