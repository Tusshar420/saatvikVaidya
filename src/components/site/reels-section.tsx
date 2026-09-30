"use client";

import Image from "next/image";
import { useState } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { HScroller } from "@/components/ui/hscroller";
import { hasDevanagari } from "@/lib/detect-hindi";
import { cn } from "@/lib/cn";
import type { ReelItem, SectionHeading as SectionHeadingData } from "@/server/content/home";

export type ReelsSectionProps = {
  heading: SectionHeadingData;
  filters: Record<string, string>;
  reels: ReelItem[];
};

export function ReelsSection({ heading, filters, reels }: ReelsSectionProps) {
  const [selectedFilter, setSelectedFilter] = useState("all");

  const filterOptions = [
    { label: filters.all, value: "all" },
    { label: filters.PRODUCT, value: "PRODUCT" },
    { label: filters.FEEDBACK, value: "FEEDBACK" },
    { label: filters.LEARNING, value: "LEARNING" },
    { label: filters.OFFER, value: "OFFER" },
  ];

  const filteredReels =
    selectedFilter === "all"
      ? reels
      : reels.filter((reel) => reel.type === selectedFilter);

  const reelCards = filteredReels.map((reel) => (
    <ReelCard key={reel.key} reel={reel} />
  ));

  return (
    <section className="section-y">
      <div className="shell">
        <SectionHeading {...heading} />

        <div className="mb-8 mt-8">
          <ChoiceChips
            label="Filter reels"
            hideLabel
            layout="wrap"
            value={selectedFilter}
            onValueChange={setSelectedFilter}
            options={filterOptions}
          />
        </div>

        {/* Desktop grid, phone scroller */}
        <div className="hidden md:grid gap-6 grid-cols-2 lg:grid-cols-3">
          {reelCards}
        </div>
        <HScroller label="Reels scroller" className="md:hidden">{reelCards}</HScroller>
      </div>
    </section>
  );
}

function ReelCard({ reel }: { reel: ReelItem }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-raised">
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-md",
          "bg-surface-alt"
        )}
      >
        {reel.mediaKind === "VIDEO" && (
          <>
            {reel.posterSrc ? (
              <Image
                src={reel.posterSrc}
                alt={reel.title}
                fill
                className="absolute inset-0 object-cover"
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              />
            ) : (
              <div className="absolute inset-0 bg-surface-alt" />
            )}
            <video
              preload="none"
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              poster={reel.posterSrc || undefined}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              {reel.mediaSrc && <source src={reel.mediaSrc} type="video/mp4" />}
            </video>
            {!isPlaying && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  (e.currentTarget.parentElement?.querySelector(
                    "video",
                  ) as HTMLVideoElement | null)?.play?.();
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
                aria-label={`Play ${reel.title} video`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-xl text-ink">
                  ▶
                </span>
              </button>
            )}
            {reel.mediaLabel && (
              <span className="absolute top-3 right-3 rounded-sm bg-orange-strong px-2 py-1 text-xs font-700 text-surface">
                {reel.mediaLabel}
              </span>
            )}
            {reel.metaLabel && (
              <span className="absolute bottom-3 right-3 text-xs font-500 text-surface/90 bg-black/40 rounded px-2 py-1">
                {reel.metaLabel}
              </span>
            )}
          </>
        )}
        {reel.mediaKind === "IMAGE" && reel.mediaSrc && (
          <>
            <Image
              src={reel.mediaSrc}
              alt={reel.title}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            />
            {reel.badge && (
              <span
                className={cn(
                  "absolute top-3 right-3 rounded-sm px-2 py-1 text-xs font-700 text-surface shadow-md",
                  reel.badgeTone === "ORANGE"
                    ? "bg-orange-strong"
                    : reel.badgeTone === "GOLD"
                      ? "bg-gold"
                      : "bg-teal",
                )}
              >
                {reel.badge}
              </span>
            )}
            {reel.valueLabel && (
              <span className="absolute bottom-3 right-3 text-xs font-500 text-gold-ink bg-gold-soft rounded px-2 py-1">
                {reel.valueLabel}
              </span>
            )}
          </>
        )}
        {reel.mediaKind === "POSTER" && reel.poster && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col gap-3 justify-center items-center px-4 py-6 text-center text-surface",
              "bg-learning"
            )}
          >
            {reel.poster.kicker && (
              <p className="text-label font-700 flex items-center justify-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger text-xs">
                  ●
                </span>
                {reel.poster.kicker}
              </p>
            )}
            <p
              className={cn("text-h3", {
                "font-serif-hindi": hasDevanagari(reel.poster.text),
              })}
              lang={hasDevanagari(reel.poster.text) ? "hi" : undefined}
            >
              {reel.poster.text}
            </p>
            {reel.poster.byline && (
              <p className="text-small text-surface/90">{reel.poster.byline}</p>
            )}
            {reel.metaLabel && (
              <span className="text-small font-500 text-surface/90">
                {reel.metaLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-small font-700 text-ink">{reel.title}</h3>
        {reel.link.href !== null ? (
          <a
            href={reel.link.href}
            className="text-small font-500 text-teal hover:underline"
          >
            {reel.link.label} →
          </a>
        ) : (
          <span className="text-small font-500 text-muted">
            {reel.link.label} →
          </span>
        )}
      </div>
    </article>
  );
}
