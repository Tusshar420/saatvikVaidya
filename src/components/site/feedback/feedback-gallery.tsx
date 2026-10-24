"use client";

import { useState } from "react";
import Image from "next/image";
import { MessageSquareQuote, Package, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { portalPages } from "@/content/portal-pages";
import type { FeedbackCardItem } from "@/server/content/pages";
import { pillClasses, portalCardClasses } from "../portal/page-hero";

const copy = portalPages.feedback;

type Filter = keyof typeof copy.filters;
const filters = Object.keys(copy.filters) as Filter[];

const cardClasses = cn(
  portalCardClasses,
  "flex h-full w-[270px] shrink-0 snap-start flex-col overflow-hidden sm:w-auto",
);
const badgeClasses =
  "absolute top-3 left-3 rounded-[7px] bg-brand/90 px-2 py-1.5 text-[11px] font-extrabold tracking-[0.04em] text-white uppercase";

/**
 * Real Feedback gallery (`.feedback-gallery`): the published Feedback rows
 * (original letterheads) with All / Letterheads / Videos / Products received
 * filters. Videos and product photos aren't collected yet, so those show a
 * "Coming next" card.
 */
export function FeedbackGallery({ items }: { items: FeedbackCardItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const showLetterheads = filter === "all" || filter === "letterheads";
  const showVideo = filter === "all" || filter === "videos";

  return (
    <>
      <div
        role="group"
        aria-label={copy.filtersLabel}
        className="scrollbar-none mb-5 flex gap-1.5 overflow-x-auto"
      >
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={pillClasses(
              filter === f,
              cn("rounded-[9px]", filter !== f && "text-ink"),
            )}
          >
            {copy.filters[f]}
          </button>
        ))}
      </div>

      {filter === "products" ? (
        <EmptyState
          icon={<Package aria-hidden />}
          badge={<Badge variant="soon">{portalPages.comingNext}</Badge>}
          title={copy.productsTitle}
          description={copy.productsText}
        />
      ) : filter === "letterheads" && items.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote aria-hidden />}
          title={copy.emptyTitle}
          description={copy.emptyText}
        />
      ) : (
        <ul className="scrollbar-none -mr-3.25 flex snap-x snap-mandatory gap-3.75 overflow-x-auto pr-3.25 pb-1 sm:mr-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 lg:grid-cols-3">
          {showLetterheads &&
            items.map((item) => (
              <li key={item.key} className="contents">
                <LetterheadCard item={item} />
              </li>
            ))}
          {showVideo && (
            <li className="contents">
              <VideoCard />
            </li>
          )}
        </ul>
      )}
    </>
  );
}

function LetterheadCard({ item }: { item: FeedbackCardItem }) {
  return (
    <article className={cardClasses}>
      <div className="relative h-67.5 overflow-hidden bg-track">
        <Image
          src={item.imageSrc}
          alt={item.imageAlt}
          fill
          sizes="(min-width: 1100px) 380px, (min-width: 560px) 50vw, 270px"
          className="object-cover object-top"
        />
        <span className={badgeClasses}>{item.badge}</span>
      </div>
      <div className="flex flex-1 flex-col p-4.25">
        <h3 className="line-clamp-2 font-heading text-base font-extrabold text-ink">
          {item.quote}
        </h3>
        <p className="mt-1.5 text-small text-muted">{item.caption}</p>
        <footer className="mt-auto flex items-center justify-end gap-2 pt-2">
          <Modal>
            <ModalTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center text-small font-extrabold text-brand hover:underline"
              >
                {copy.viewOriginal} →
              </button>
            </ModalTrigger>
            <ModalContent
              title={copy.modalTitle}
              description={copy.modalText}
              className="sm:w-[min(560px,calc(100%-40px))]"
            >
              <Image
                src={item.imageSrc}
                alt={item.imageAlt}
                width={1200}
                height={1600}
                sizes="(min-width: 560px) 500px, 100vw"
                className="h-auto w-full rounded-[13px] border border-line"
              />
            </ModalContent>
          </Modal>
        </footer>
      </div>
    </article>
  );
}

function VideoCard() {
  return (
    <article className={cardClasses}>
      <div className="relative grid h-67.5 place-items-center overflow-hidden bg-forest text-white">
        <div className="text-center">
          <Play aria-hidden className="mx-auto size-9 fill-white" />
          <p className="mt-2 font-heading text-[17px] font-extrabold">
            {copy.videoTitle}
          </p>
          <p className="text-xs text-forest-ink">{copy.videoCaption}</p>
        </div>
        <span className={badgeClasses}>{copy.videoBadge}</span>
      </div>
      <div className="flex flex-1 flex-col p-4.25">
        <h3 className="font-heading text-base font-extrabold text-ink">
          {copy.videoCardTitle}
        </h3>
        <p className="mt-1.5 text-small text-muted">{copy.videoCardText}</p>
        <footer className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs text-muted">{copy.consent}</span>
          <Badge variant="soon">{portalPages.comingNext}</Badge>
        </footer>
      </div>
    </article>
  );
}
