import Link from "next/link";
import { BadgeCheck, Check, Heart, MessageCircle } from "lucide-react";
import { likeAction, voteAction } from "@/app/(site)/doctor-talk/actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { pollPercent, type PollView, type ThreadAuthor, type ThreadView } from "@/lib/threads";
import { threads as copy } from "@/content/threads";
import { portalCardClasses } from "../portal/page-hero";

export function AuthorLine({ author, createdAt }: { author: ThreadAuthor; createdAt: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={author.name} size="sm" decorative />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-small font-extrabold text-ink">
          <span className="truncate">{author.name}</span>
          {author.isDoctor && (
            <BadgeCheck aria-label={copy.doctorBadge} role="img" className="size-4 shrink-0 text-brand" />
          )}
        </p>
        <p className="text-xs text-muted">
          <time dateTime={createdAt}>{formatDateTime(new Date(createdAt))}</time>
        </p>
      </div>
    </div>
  );
}

/** Like button: a plain form so it works without client JavaScript. */
export function LikeButton({ thread, canLike }: { thread: ThreadView; canLike: boolean }) {
  const label = copy.like(thread.likeCount);
  const body = (
    <>
      <Heart aria-hidden className={cn("size-4", thread.likedByMe && "fill-current")} />
      {label}
    </>
  );
  const classes = cn(
    "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-small font-bold",
    thread.likedByMe ? "text-orange-strong" : "text-muted",
  );
  if (!canLike) return <span className={classes}>{body}</span>;
  return (
    <form action={likeAction}>
      <input type="hidden" name="threadId" value={thread.id} />
      <button
        type="submit"
        aria-pressed={thread.likedByMe}
        aria-label={`${thread.likedByMe ? copy.unlikeAction : copy.likeAction}. ${label}`}
        className={cn(classes, "cursor-pointer hover:text-brand")}
      >
        {body}
      </button>
    </form>
  );
}

/**
 * A thread's poll. Each choice is a plain form, so voting works without
 * client JavaScript. Results (bars and percentages) show once the viewer has
 * voted, and always to the author.
 */
export function ThreadPoll({ threadId, poll }: { threadId: number; poll: PollView }) {
  return (
    <section aria-label={copy.poll.label} className="mt-3.5 grid gap-2">
      <ul className="grid gap-2">
        {poll.options.map((option) => {
          const mine = option.id === poll.myOptionId;
          const percent = pollPercent(option.votes, poll.totalVotes);
          const result = poll.showResults ? `, ${percent}%, ${copy.poll.votes(option.votes)}` : "";
          return (
            <li key={option.id}>
              <form action={voteAction}>
                <input type="hidden" name="threadId" value={threadId} />
                <input type="hidden" name="optionId" value={option.id} />
                <button
                  type="submit"
                  aria-pressed={mine}
                  aria-label={`${option.label}${result}${mine ? `, ${copy.poll.yourVote}` : ""}`}
                  className={cn(
                    "relative flex min-h-11 w-full cursor-pointer items-center overflow-hidden rounded-md border bg-surface px-3 text-left text-small font-bold text-ink hover:border-brand",
                    mine ? "border-brand" : "border-line",
                  )}
                >
                  {poll.showResults && (
                    <span
                      aria-hidden
                      className={cn("absolute inset-y-0 left-0", mine ? "bg-brand-soft" : "bg-surface-alt")}
                      style={{ width: `${percent}%` }}
                    />
                  )}
                  <span className="relative flex w-full min-w-0 items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {mine && <Check aria-hidden className="size-4 shrink-0 text-brand" />}
                      <span className="break-words">{option.label}</span>
                    </span>
                    {poll.showResults && <span className="shrink-0 text-muted">{percent}%</span>}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        {copy.poll.votes(poll.totalVotes)} · {poll.myOptionId === null ? copy.poll.pick : copy.poll.voted}
      </p>
    </section>
  );
}

export function ThreadCard({ thread, canLike }: { thread: ThreadView; canLike: boolean }) {
  return (
    <article className={cn(portalCardClasses, "p-5 max-sm:p-4")} aria-labelledby={`thread-${thread.id}`}>
      <div className="flex items-start justify-between gap-3">
        <AuthorLine author={thread.author} createdAt={thread.createdAt} />
        <Badge>{copy.kindLabel[thread.kind]}</Badge>
      </div>
      <h3 id={`thread-${thread.id}`} className="mt-3.5 text-h3 text-ink">
        <Link href={`/doctor-talk/${thread.id}`} className="hover:text-brand">
          {thread.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-3 text-small whitespace-pre-line text-muted">{thread.body}</p>
      {thread.poll && <ThreadPoll threadId={thread.id} poll={thread.poll} />}
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-2">
        <LikeButton thread={thread} canLike={canLike} />
        <Link
          href={`/doctor-talk/${thread.id}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-small font-bold text-muted hover:text-brand"
        >
          <MessageCircle aria-hidden className="size-4" />
          {copy.reply.count(thread.replyCount)}
        </Link>
      </div>
    </article>
  );
}
