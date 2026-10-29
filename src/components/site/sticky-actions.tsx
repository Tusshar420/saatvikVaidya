import Link from "next/link";
import { MessageCircle, MessageSquareHeart } from "lucide-react";
import { shell } from "@/content/shell";

const itemClasses =
  "flex min-h-11 items-center rounded-l-lg px-3 py-2.5 text-paper shadow-dock transition hover:pr-4 [&_svg]:size-5 [&_svg]:shrink-0";

/** Digits only, with India's 91 added to a bare 10-digit number (wa.me format). */
function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Sticky Feedback and WhatsApp buttons on the right edge, icon-only at every
 * width (the label is a hover tooltip). On phones they sit above the bottom
 * dock; from 560 px up, where there is no dock, they sit near the bottom.
 */
export function StickyActions({ phone }: { phone: string }) {
  const number = whatsappNumber(phone);
  return (
    <aside
      aria-label={shell.sticky.label}
      className="fixed right-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-140 flex flex-col items-end gap-2 sm:bottom-8"
    >
      <Link
        href="/feedback"
        title={shell.sticky.feedback}
        className={`${itemClasses} bg-brand`}
      >
        <MessageSquareHeart aria-hidden />
        <span className="sr-only">{shell.sticky.feedback}</span>
      </Link>
      {number && (
        <a
          href={`https://wa.me/${number}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={shell.sticky.whatsappHint}
          title={shell.sticky.whatsapp}
          className={`${itemClasses} bg-brand-dark`}
        >
          <MessageCircle aria-hidden />
          <span className="sr-only">{shell.sticky.whatsapp}</span>
        </a>
      )}
    </aside>
  );
}
