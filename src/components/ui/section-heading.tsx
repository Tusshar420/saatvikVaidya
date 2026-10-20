import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";
import { Eyebrow } from "./badge";
import { ButtonArrow } from "./button";

export type SectionHeadingProps = {
  eyebrow?: ReactNode;
  /** First line of the title. */
  title: ReactNode;
  /** Second line, in orange (gold on dark bands), the mockup's `<em>`. */
  emphasis?: ReactNode;
  description?: ReactNode;
  /** "View all →" style link on the right (stacked under the title on phones). */
  action?: { href: string; label?: string };
  as?: "h1" | "h2" | "h3" | "h4";
  /** Id for the heading, so a section can use aria-labelledby. */
  id?: string;
  /** `dark` for dark green bands. */
  tone?: "default" | "dark";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  emphasis,
  description,
  action,
  as: Heading = "h2",
  id,
  tone = "default",
  className,
}: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "mb-7 flex flex-col items-start gap-2.5 md:flex-row md:items-end md:justify-between md:gap-8",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <Eyebrow tone={dark ? "light" : "brand"}>{eyebrow}</Eyebrow>}
        <Heading
          id={id}
          className={cn(
            "mt-2 text-h2 text-balance",
            dark ? "text-white" : "text-ink",
          )}
        >
          {title}
          {emphasis && (
            <>
              {" "}
              <em
                className={cn(
                  "block not-italic",
                  dark ? "text-gold-light" : "text-orange-title",
                )}
              >
                {emphasis}
              </em>
            </>
          )}
        </Heading>
        {description && (
          <p
            className={cn(
              "mt-2.5 max-w-175 text-body",
              dark ? "text-brand-soft" : "text-muted",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-2 text-small font-black whitespace-nowrap underline-offset-4 hover:underline",
            dark ? "text-white" : "text-brand",
          )}
        >
          {action.label ?? ui.viewAll}
          <ButtonArrow />
        </Link>
      )}
    </div>
  );
}
