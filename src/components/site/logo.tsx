import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { shell } from "@/content/shell";
import logo from "../../../public/brand/logo.png";

export type LogoProps = {
  /** `light` for the dark footer band (the logo turns white). */
  tone?: "default" | "light";
  /**
   * Kept for API compatibility: the client's logo image carries the Hindi
   * tagline itself, so this no longer changes anything.
   */
  tagline?: boolean;
  /** Render the image only, not wrapped in a home link (sign-in modal). */
  asLink?: boolean;
  /** Load eagerly (the header logo is above the fold). */
  priority?: boolean;
  /** Size the image; the default is the header size (58 / 64 / 74 px tall). */
  imageClassName?: string;
  className?: string;
};

/** The client's logo (public/brand/logo.png), linking home. */
export function Logo({
  tone = "default",
  asLink = true,
  priority = false,
  imageClassName,
  className,
}: LogoProps) {
  const image = (
    <Image
      src={logo}
      alt={asLink ? "" : shell.header.logoAlt}
      priority={priority}
      sizes="180px"
      className={cn(
        "h-14.5 w-30.25 object-contain sm:h-16 sm:w-35 md:h-18.5 md:w-43",
        tone === "light" && "opacity-95 brightness-0 invert",
        imageClassName,
      )}
    />
  );
  if (!asLink) return <span className={cn("inline-flex", className)}>{image}</span>;
  return (
    <Link
      href="/"
      aria-label={shell.brand.homeLabel}
      // A logotype, which WCAG 1.4.3 exempts from contrast minimums;
      // accessibility tests skip [data-logo] for that reason.
      data-logo=""
      className={cn("inline-flex shrink-0 items-center rounded-md", className)}
    >
      {image}
    </Link>
  );
}
