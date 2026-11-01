import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { shell } from "@/content/shell";
import logo from "../../../public/brand/logo.png";
import logoMark from "../../../public/brand/logo-mark.png";

export type LogoProps = {
  /** `light` for the dark footer band (the logo turns white). */
  tone?: "default" | "light";
  /**
   * Kept for API compatibility: the client's logo image carries the Hindi
   * tagline itself, so this no longer changes anything.
   */
  tagline?: boolean;
  /**
   * The header version: the logo without its Hindi slogan
   * (public/brand/logo-mark.png), with "Empowering Doctors!" as text under it,
   * between an orange and a green rule like the slogan it replaces.
   */
  slogan?: boolean;
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
  slogan = false,
  priority = false,
  imageClassName,
  className,
}: LogoProps) {
  if (slogan) return <SloganLogo priority={priority} className={className} />;
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

/** The header logo: the mark without the slogan, and the text slogan under it. */
function SloganLogo({ priority, className }: { priority: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label={shell.brand.homeLabel}
      data-logo=""
      className={cn("inline-flex w-max shrink-0 flex-col items-stretch rounded-md", className)}
    >
      <Image
        src={logoMark}
        alt=""
        priority={priority}
        sizes="160px"
        className="h-9.5 w-auto object-contain sm:h-10.5 md:h-12"
      />
      <span
        aria-hidden
        className="mt-0.5 border-t-2 border-b-2 border-t-logo-orange border-b-logo-green py-px text-center font-heading text-[9px] leading-tight font-extrabold tracking-[0.06em] whitespace-nowrap text-ink sm:text-[10px] md:mt-1 md:text-[11px]"
      >
        {shell.brand.slogan}
      </span>
    </Link>
  );
}
