import Link from "next/link";
import { Check } from "lucide-react";
import { quiz as copy } from "@/content/quiz";
import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/format";
import type { QuizBox, QuizGroup } from "@/server/quiz/view";

const text = copy.grid;

/** One soft tint per category, in turn, so neighbouring groups look apart. */
const tones = [
  "bg-brand-soft text-brand",
  "bg-orange-soft text-orange-ink",
  "bg-gold-soft text-gold-ink",
  "bg-blue-soft text-blue",
] as const;

/**
 * The /quiz boxes: a heading per category, then a grid of quiz boxes (three
 * across on phones, four from tablets up), each a tinted square with the
 * quiz's mark and its title under it. Every box opens /quiz/[id].
 */
export function QuizGrid({ groups }: { groups: QuizGroup[] }) {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {groups.map((group, index) => {
        const headingId = `quiz-group-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId}>
            <h2 id={headingId} className="font-heading text-[20px] font-extrabold tracking-[-0.02em] text-ink sm:text-h3">
              {group.name ?? text.more}
            </h2>
            <ul className="mt-3.5 grid grid-cols-3 gap-x-2.5 gap-y-4 sm:mt-4.5 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-5.5">
              {group.quizzes.map((box) => (
                <li key={box.id} className="min-w-0">
                  <QuizBoxLink box={box} tone={tones[index % tones.length]!} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function QuizBoxLink({ box, tone }: { box: QuizBox; tone: string }) {
  const when = box.open ? text.until(formatDayMonth(box.endsAt)) : text.opens(formatDayMonth(box.startsAt));
  return (
    <Link
      href={`/quiz/${box.id}`}
      data-testid="quiz-box"
      className="group flex flex-col items-center gap-2 rounded-lg text-center focus-visible:outline-offset-4"
    >
      <span
        aria-hidden
        className={cn(
          "relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg border border-line font-serif-hindi text-[34px] leading-none font-bold transition-shadow group-hover:shadow-raised sm:text-5xl",
          box.open ? tone : "bg-surface-alt text-muted",
        )}
      >
        {box.glyph ?? text.glyph}
        {box.played === "done" && (
          <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-brand text-white sm:size-7">
            <Check className="size-3.5 sm:size-4" />
          </span>
        )}
      </span>
      <span className="line-clamp-2 font-heading text-small leading-snug font-bold text-ink sm:text-sm">{box.title}</span>
      <span className="-mt-1.5 text-[12px] leading-snug text-muted sm:text-small">
        {box.played === "done" ? text.played : box.played === "playing" ? text.playing : when}
      </span>
    </Link>
  );
}
