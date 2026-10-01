import { BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";

/** An ebook's cover (3:4), or a plain book tile when there's none. */
export function EbookCover({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "aspect-[3/4] overflow-hidden rounded-lg border border-line bg-teal-soft",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own image route
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden className="grid size-full place-items-center text-teal">
          <BookOpen className="size-1/3" strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
