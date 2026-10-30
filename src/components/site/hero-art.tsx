import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type HeroArtKind = "intro" | "talk" | "quiz" | "launch" | "grow" | "podium";

/**
 * Decorative illustrations for the hero carousel slides (homepage and Quiz &
 * Win), drawn in SVG with the colour tokens so they sit on the dark green hero. Purely visual: the slide
 * text carries the meaning, so each one is aria-hidden.
 */
export function HeroArt({
  kind,
  className,
}: {
  kind: HeroArtKind;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("relative shrink-0", className)}>
      <div className="absolute inset-[6%] rounded-full bg-white/8 ring-1 ring-white/12" />
      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-gold)_30%,transparent),transparent_70%)]" />
      <svg viewBox="0 0 160 160" className="relative size-full">
        {ART[kind]}
        <g className="fill-gold-light">
          <path d="M132 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" />
          <circle cx="24" cy="120" r="3" className="opacity-70" />
          <circle cx="140" cy="112" r="2" className="opacity-60" />
        </g>
      </svg>
    </div>
  );
}

const LEAF = "M0 0C10-14 30-16 40-10 32 2 14 8 0 0z";

const ART: Record<HeroArtKind, ReactNode> = {
  // Mortar and pestle with herbs.
  intro: (
    <g>
      <path
        d={LEAF}
        transform="translate(46 66) rotate(-62)"
        className="fill-brand-light"
      />
      <path
        d={LEAF}
        transform="translate(82 64) rotate(-118) scale(1 -1)"
        className="fill-brand-light/70"
      />
      <path d="M64 66V46" className="stroke-brand-light" strokeWidth="3" />
      <rect
        x="86"
        y="30"
        width="12"
        height="62"
        rx="6"
        transform="rotate(28 92 61)"
        className="fill-gold"
      />
      <path
        d="M36 82h88c0 26-18 44-44 44S36 108 36 82z"
        className="fill-orange"
      />
      <path d="M36 82h88" className="stroke-orange-light" strokeWidth="6" strokeLinecap="round" />
      <path d="M58 126h44l4 10H54z" className="fill-orange-dark" />
      <path
        d="M52 98c8 10 22 14 36 12"
        className="stroke-white/35"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  ),
  // Two doctors talking, one verified.
  talk: (
    <g>
      <rect x="26" y="34" width="84" height="56" rx="18" className="fill-white" />
      <path d="M44 88l-6 18 22-16z" className="fill-white" />
      <g className="fill-brand">
        <circle cx="52" cy="62" r="5" />
        <circle cx="68" cy="62" r="5" />
        <circle cx="84" cy="62" r="5" />
      </g>
      <rect x="70" y="82" width="66" height="44" rx="16" className="fill-orange" />
      <path d="M118 124l8 14-20-12z" className="fill-orange" />
      <path
        d={LEAF}
        transform="translate(88 112) rotate(-28) scale(0.8)"
        className="fill-white"
      />
      <circle cx="112" cy="40" r="14" className="fill-gold" />
      <path
        d="M105 40l5 5 9-10"
        className="stroke-brand"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  ),
  // Trophy and coins.
  quiz: (
    <g>
      <path
        d="M52 38h56v18c0 18-12 32-28 32S52 74 52 56z"
        className="fill-gold"
      />
      <path
        d="M52 46H38c0 16 8 24 18 26M108 46h14c0 16-8 24-18 26"
        className="stroke-gold"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M74 88h12v14H74z" className="fill-gold" />
      <rect x="60" y="102" width="40" height="12" rx="4" className="fill-orange" />
      <path
        d="M80 48l3.5 7 7.5 1-5.5 5 1.5 7.5-7-3.6-7 3.6 1.5-7.5-5.5-5 7.5-1z"
        className="fill-gold-ink/60"
      />
      <g className="fill-gold-light stroke-gold-ink/50" strokeWidth="2">
        <ellipse cx="36" cy="126" rx="14" ry="5" />
        <ellipse cx="36" cy="119" rx="14" ry="5" />
        <ellipse cx="124" cy="128" rx="14" ry="5" />
        <ellipse cx="124" cy="121" rx="14" ry="5" />
        <ellipse cx="124" cy="114" rx="14" ry="5" />
      </g>
    </g>
  ),
  // A product bottle with "your logo" label.
  launch: (
    <g>
      <rect x="62" y="26" width="36" height="16" rx="4" className="fill-orange" />
      <rect x="66" y="42" width="28" height="10" className="fill-white/70" />
      <path
        d="M56 52h48c6 0 10 4 10 10v62c0 6-4 10-10 10H56c-6 0-10-4-10-10V62c0-6 4-10 10-10z"
        className="fill-white"
      />
      <rect x="52" y="70" width="56" height="46" rx="6" className="fill-gold" />
      <circle cx="80" cy="86" r="9" className="fill-brand" />
      <path
        d={LEAF}
        transform="translate(74 90) rotate(-50) scale(0.35)"
        className="fill-brand-light"
      />
      <rect x="64" y="100" width="32" height="4" rx="2" className="fill-brand/70" />
      <rect x="70" y="108" width="20" height="3" rx="1.5" className="fill-brand/40" />
      <path
        d={LEAF}
        transform="translate(110 128) rotate(-40)"
        className="fill-brand-light"
      />
      <path
        d={LEAF}
        transform="translate(50 130) rotate(-140) scale(0.7 -0.7)"
        className="fill-brand-light/70"
      />
    </g>
  ),
  // Rising bars with a growth arrow.
  grow: (
    <g>
      <rect x="34" y="96" width="20" height="34" rx="5" className="fill-white/35" />
      <rect x="62" y="80" width="20" height="50" rx="5" className="fill-brand-light" />
      <rect x="90" y="62" width="20" height="68" rx="5" className="fill-gold" />
      <rect x="118" y="44" width="20" height="86" rx="5" className="fill-orange" />
      <path
        d="M30 84l30-22 22 12 42-38"
        className="stroke-white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M110 34l18-2-2 18z" className="fill-white" />
      <path d="M26 132h116" className="stroke-white/30" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  // Winners' podium with a star over first place.
  podium: (
    <g>
      <rect x="30" y="92" width="34" height="40" rx="5" className="fill-brand-light" />
      <rect x="63" y="70" width="34" height="62" rx="5" className="fill-gold" />
      <rect x="96" y="104" width="34" height="28" rx="5" className="fill-orange" />
      <path
        d="M80 48l3.5 7 7.5 1-5.5 5 1.5 7.5-7-3.6-7 3.6 1.5-7.5-5.5-5 7.5-1z"
        transform="translate(80 42) scale(1.5) translate(-80 -57)"
        className="fill-white"
      />
      <circle cx="47" cy="80" r="6" className="fill-white/70" />
      <circle cx="113" cy="92" r="6" className="fill-white/50" />
      <rect x="72" y="84" width="16" height="4" rx="2" className="fill-gold-ink/50" />
      <path d="M22 132h116" className="stroke-white/30" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
};
