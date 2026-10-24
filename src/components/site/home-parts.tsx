import type { ReactNode } from "react";
import {
  BookOpen,
  FileQuestion,
  Leaf,
  MessageSquareText,
  ShoppingBag,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

// Small pieces shared by the v2 homepage sections (docs/mockup-v2/index.html):
// the eyebrow, the section head and the icon set.

/** `.eyebrow`: a 28 × 2 px orange bar, then an uppercase Manrope label. */
export function HomeEyebrow({
  children,
  light = false,
  className,
}: {
  children: ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-3.5 flex items-center gap-2.25 font-heading text-label uppercase sm:mb-4.5",
        light ? "text-brand-soft" : "text-brand-mid",
        className,
      )}
    >
      <span aria-hidden className="h-0.5 w-7 shrink-0 rounded-sm bg-orange" />
      {children}
    </p>
  );
}

/** `.section-head`: eyebrow and two-line title on the left, intro on the right. */
export function HomeHead({
  eyebrow,
  title,
  emphasis,
  description,
  aside,
  compact = false,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  emphasis?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3.75 md:flex-row md:justify-between md:gap-12.5",
        compact ? "mb-5.5 sm:mb-7 md:items-center" : "mb-7.5 md:mb-10.5 md:items-end",
        className,
      )}
    >
      <div className="reveal min-w-0">
        {eyebrow && <HomeEyebrow>{eyebrow}</HomeEyebrow>}
        <h2
          className={cn(
            "m-0 text-ink",
            compact ? "text-[31px] leading-[1.05] font-extrabold tracking-[-0.045em] sm:text-4xl" : "text-h2",
          )}
        >
          {title}
          {emphasis && (
            <>
              {" "}
              <span className="block">{emphasis}</span>
            </>
          )}
        </h2>
      </div>
      {description && (
        <p className="reveal m-0 max-w-155 text-sm leading-[1.55] text-muted sm:text-[15px] sm:leading-[1.7] md:max-w-112.5">
          {description}
        </p>
      )}
      {aside}
    </div>
  );
}

/** The mockup's icon sprite, by meaning. */
export const homeIcons = {
  talk: MessageSquareText,
  quiz: FileQuestion,
  launch: Leaf,
  grow: ShoppingBag,
  book: BookOpen,
  star: Star,
} satisfies Record<string, LucideIcon>;

/** Why Saatvik card icons, in card order. */
export const whyIcons: LucideIcon[] = [
  MessageSquareText,
  BookOpen,
  FileQuestion,
  Leaf,
  ShoppingBag,
  Star,
];
