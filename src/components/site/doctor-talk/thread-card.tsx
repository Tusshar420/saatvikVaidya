import Link from "next/link";
import { BadgeCheck, Heart, MessageCircle } from "lucide-react";
import { likeAction } from "@/app/(site)/doctor-talk/actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { ThreadAuthor, ThreadView } from "@/lib/threads";
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
