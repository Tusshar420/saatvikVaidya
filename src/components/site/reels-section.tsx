"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CirclePlay, X } from "lucide-react";
import { home as copy } from "@/content/home";
import { cn } from "@/lib/cn";
import type { ReelItem, SectionHeading as SectionHeadingData } from "@/server/content/home";
import { HomeHead } from "./home-parts";

export type ReelsSectionProps = {
  heading: SectionHeadingData;
  filters: Record<string, string>;
  reels: ReelItem[];
};

const reelBackground: Record<ReelItem["type"], string> = {
  PRODUCT: "bg-pack-green",
  FEEDBACK: "bg-pack-saffron",
  LEARNING: "bg-pack-blue",
  OFFER: "bg-pack-gold",
};

/** v2 "Watch & explore" (`.reels-section`): filter pills and four tall reel cards. */
export function ReelsSection({ heading, filters, reels }: ReelsSectionProps) {
  const [filter, setFilter] = useState("all");
  const types = new Set(reels.map((reel) => reel.type));
  const options = Object.entries(filters).filter(
    ([value]) => value === "all" || types.has(value as ReelItem["type"]),
  );
  const shown = filter === "all" ? reels : reels.filter((reel) => reel.type === filter);

  return (
    <section id="reels" aria-labelledby="reels-title" className="bg-surface py-14.5 md:py-21.25">
      <div className="shell">
        <HomeHead
          compact
          eyebrow={heading.eyebrow}
          title={<span id="reels-title">{heading.title}</span>}
          emphasis={heading.titleEmphasis}
          aside={
            options.length > 2 ? (
              <div
                role="group"
                aria-label={filters.filtersLabel ?? "Filter reels"}
                className="scrollbar-none flex max-w-full gap-1.25 overflow-auto"
              >
                {options.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "min-h-11 rounded-md border px-3.5 text-xs font-bold whitespace-nowrap transition md:min-h-9",
                      filter === value
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-surface text-ink hover:border-brand",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null
          }
        />

        <ul
          aria-label={copy.reels.scroller}
          tabIndex={0}
          className="scrollbar-none -mr-3.25 flex snap-x snap-mandatory gap-3.75 overflow-x-auto pb-2 sm:mr-0"
        >
          {shown.map((reel) => (
            <li key={reel.key} className="w-54.5 shrink-0 snap-start sm:w-61.25 md:w-[calc((100%-45px)/4)]">
              <ReelCard reel={reel} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ReelCard({ reel }: { reel: ReelItem }) {
  const [playing, setPlaying] = useState(false);
  const isVideo = reel.mediaKind === "VIDEO" && reel.mediaSrc;
  const image = reel.mediaKind === "IMAGE" ? reel.mediaSrc : reel.posterSrc;
  const label = reel.badge ?? reel.poster?.kicker ?? null;

  const body = (
    <>
      {image && (
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 820px) 25vw, 245px"
          className="object-cover opacity-35 mix-blend-luminosity"
        />
      )}
      <span
        aria-hidden
        className="absolute top-10 left-1/2 size-55 -translate-x-1/2 rounded-full border-[34px] border-white/14"
      />
      <span aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent from-20% to-black/78" />
      {label && (
        <span className="absolute top-4 left-4 z-1 rounded-[7px] bg-white/15 px-2 py-1.5 font-heading text-[11px] font-extrabold tracking-[0.11em] uppercase backdrop-blur-sm">
          {label}
        </span>
      )}
      <span aria-hidden className="absolute inset-0 z-1 grid place-items-center">
        <CirclePlay className="size-13 fill-white/12 stroke-[1.8]" />
      </span>
      <span className="relative z-1 max-w-47.5 font-heading text-base leading-tight font-bold">
        {reel.title}
      </span>
      {(reel.metaLabel ?? reel.valueLabel) && (
        <span className="relative z-1 mt-2 text-[11px] opacity-80">{reel.metaLabel ?? reel.valueLabel}</span>
      )}
    </>
  );

  const cardClasses = cn(
    "relative flex min-h-75.5 w-full flex-col items-start justify-end overflow-hidden rounded-[21px] p-5 text-left text-white shadow-card transition motion-safe:hover:-translate-y-0.75 md:min-h-82.5",
    reelBackground[reel.type],
  );

  if (isVideo) {
    if (playing) {
      return (
        <div className={cn(cardClasses, "p-0")}>
          <video
            src={reel.mediaSrc ?? undefined}
            autoPlay
            controls
            playsInline
            className="absolute inset-0 size-full bg-ink object-cover"
            aria-label={reel.mediaLabel ?? reel.title}
          />
          <button
            type="button"
            onClick={() => setPlaying(false)}
            aria-label={copy.reels.close}
            className="absolute top-2 right-2 z-1 grid size-11 place-items-center rounded-full bg-ink/60 text-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={copy.reels.play(reel.title)}
        className={cardClasses}
      >
        {body}
      </button>
    );
  }

  if (reel.link.href) {
    return (
      <Link href={reel.link.href} className={cardClasses}>
        {body}
      </Link>
    );
  }
  return <div className={cardClasses}>{body}</div>;
}
