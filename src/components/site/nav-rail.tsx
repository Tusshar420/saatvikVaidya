"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Phone } from "lucide-react";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/phone";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useScrollEdges } from "@/lib/use-scroll-edges";
import { shell, type NavItem } from "@/content/shell";

const TOP = "top";

export type NavRailProps = {
  items: readonly NavItem[];
  /** Support number, shown at the end of the rail from 1280 px up. */
  phone: string;
  className?: string;
};

/**
 * The section rail under the header bar. It scrolls sideways (with an edge
 * fade) when the links don't fit, and on the homepage highlights the section
 * on screen and keeps that link in view.
 */
export function NavRail({ items, phone, className }: NavRailProps) {
  const onHome = usePathname() === "/";
  const [spied, setSpied] = useState<string>(TOP);
  const active = onHome ? spied : null;
  const reducedMotion = useReducedMotion();
  const { ref, onScroll, style } = useScrollEdges<HTMLDivElement>("38px");

  // Scroll-spy: the active section is the last one whose top has passed 40%
  // of the viewport (or the last one, once the page is scrolled to the end).
  useEffect(() => {
    if (!onHome) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const atEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      const line = window.innerHeight * 0.4;
      let current = TOP;
      for (const { id } of items) {
        const section = document.getElementById(id);
        if (section && (atEnd || section.getBoundingClientRect().top <= line))
          current = id;
      }
      setSpied(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [onHome, items]);

  // Bring the active link into view inside the rail (sideways only).
  useEffect(() => {
    const rail = ref.current;
    if (!rail || !active) return;
    const link = rail.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!link) return;
    const railBox = rail.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.left < railBox.left || linkBox.right > railBox.right - 38) {
      rail.scrollTo({
        left: rail.scrollLeft + linkBox.left - railBox.left - 12,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }, [active, reducedMotion, ref]);

  return (
    <nav
      aria-label={shell.nav.label}
      className={cn("border-t border-line/60", className)}
    >
      <div
        ref={ref}
        onScroll={onScroll}
        style={style}
        className="scrollbar-none overflow-x-auto md:shell"
      >
        <ul className="flex h-12 w-max min-w-full items-center gap-1.75 px-3 sm:px-3.5 md:h-13 md:px-0 xl:gap-0.5">
          <li>
            <RailLink
              section={TOP}
              active={active === TOP}
              label={shell.nav.home}
              className="w-9.5 px-0"
            >
              <House aria-hidden className="size-4.5" />
            </RailLink>
          </li>
          {items.map((item) => (
            <li key={item.id}>
              <RailLink section={item.id} active={active === item.id}>
                {item.label}
                {item.soon && (
                  <span className="rounded-[5px] bg-orange-soft px-1.5 py-0.5 text-[11px] leading-none font-extrabold tracking-[0.06em] text-orange-ink uppercase">
                    {shell.nav.soon}
                  </span>
                )}
              </RailLink>
            </li>
          ))}
          <li className="ml-auto pl-2 max-xl:hidden">
            <a
              href={telHref(phone)}
              title={shell.header.callUs}
              className="group inline-flex h-11 items-center focus-visible:outline-offset-[-2px]"
            >
              <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-small font-bold text-teal transition group-hover:bg-teal-soft">
                <Phone aria-hidden className="size-4" />
                {phone}
              </span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function RailLink({
  section,
  active,
  label,
  className,
  children,
}: {
  section: string;
  active: boolean;
  /** For icon-only links. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={`/#${section}`}
      data-section={section}
      aria-current={active ? "location" : undefined}
      aria-label={label}
      title={label}
      // The link is 44 px tall for touch; the visible pill inside is 36 px.
      className="group inline-flex h-11 items-center focus-visible:outline-offset-[-2px]"
    >
      <span
        className={cn(
          "inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] px-3 text-xs font-bold whitespace-nowrap transition md:text-small",
          active
            ? "bg-teal-soft text-teal"
            : "text-ink/80 group-hover:bg-teal-soft group-hover:text-teal",
          className,
        )}
      >
        {children}
      </span>
    </Link>
  );
}
