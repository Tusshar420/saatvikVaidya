import Link from "next/link";
import { CalendarDays, Radio } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { portalPages } from "@/content/portal-pages";
import type { LiveCardItem } from "@/server/content/pages";
import { portalCardClasses } from "../portal/page-hero";

const copy = portalPages.courses;

/** "Upcoming Saatvik Live" cards (`.live-list`), from LiveSession rows. */
export function LiveList({ sessions }: { sessions: LiveCardItem[] }) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<Radio aria-hidden />}
        tone="orange"
        title={copy.emptyLiveTitle}
        description={copy.emptyLiveText}
      />
    );
  }
  return (
    <ul className="grid gap-3.5 md:grid-cols-2">
      {sessions.map((s) => (
        <li key={s.key}>
          <article className={cn(portalCardClasses, "h-full p-5.5")}>
            <div className="flex gap-3.75">
              <span
                aria-hidden
                className="flex h-14.5 w-13.75 shrink-0 flex-col items-center justify-center rounded-md bg-orange-soft text-orange-ink"
              >
                <CalendarDays className="size-5.5" />
                <span className="mt-1 text-[9px] font-extrabold tracking-[0.08em] uppercase">
                  {s.tag.split(" ").pop()}
                </span>
              </span>
              <div className="min-w-0">
                <h3 className="mt-1 mb-1 text-h4 text-ink">{s.title}</h3>
                <p className="text-small text-muted">{s.body}</p>
              </div>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-2 pt-4.5">
              <span className="text-small font-extrabold text-brand">
                <span className="sr-only">{s.meta.label}: </span>
                {s.meta.value}
              </span>
              {s.link.href ? (
                <Link
                  href={s.link.href}
                  className="inline-flex min-h-11 items-center text-small font-extrabold text-brand hover:underline"
                >
                  {s.link.label} →
                </Link>
              ) : (
                <span className="inline-flex min-h-11 items-center text-small font-bold text-muted">
                  {copy.liveSoon}
                </span>
              )}
            </footer>
          </article>
        </li>
      ))}
    </ul>
  );
}
