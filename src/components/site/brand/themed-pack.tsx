import { brand as copy } from "@/content/brand";
import { brandThemeOf, type BrandThemeKey } from "@/lib/brand-theme";
import { cn } from "@/lib/cn";

const text = copy.customise;

/** Header strip and text colour per theme (the body colour is the theme's `pack`). */
const headers: Record<BrandThemeKey, string> = {
  "classic-green": "bg-cta text-white",
  "saffron-glow": "bg-brand-mid text-white",
  "royal-maroon": "bg-pack-gold text-ink",
  "minimal-white": "bg-brand text-white",
};

export type ThemedPackProps = {
  theme: BrandThemeKey;
  name: string;
  /** "Tablet • 60 tabs". */
  detail: string;
  /** The buyer's brand, once typed; "Your Brand" until then. */
  brandName?: string | null;
  marketedBy?: string | null;
  mrp?: string | null;
  /** An image logo, drawn in the header's round mark. */
  logoSrc?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { box: "w-full max-w-17", head: "gap-1 px-1.5 py-1 text-[5px]", mark: "size-2", body: "px-1.5 py-1.5", kicker: "text-[3px]", title: "text-[6px] mt-1", detail: "text-[3.5px] mt-1", foot: "px-1.5 py-1 text-[3.5px]" },
  md: { box: "w-full max-w-60", head: "gap-2 px-3 py-2.5 text-[10px]", mark: "size-4.5", body: "px-3 py-4", kicker: "text-[6px]", title: "text-[15px] mt-2", detail: "text-[8px] mt-3", foot: "px-3 py-2 text-[7px]" },
  lg: { box: "w-full max-w-[360px]", head: "gap-3 px-5 py-4 text-[17px]", mark: "size-8", body: "px-5 py-8", kicker: "text-[10px]", title: "text-[34px] mt-3", detail: "text-[15px] mt-6", foot: "px-5 py-4 text-[14px]" },
} as const;

/**
 * The branded pack as a drawn label: a coloured header with the buyer's brand,
 * the product on the theme's colour, and the "Marketed by" and MRP footer.
 * Decorative (the product name is always next to it), so it is hidden from
 * screen readers.
 */
export function ThemedPack({
  theme,
  name,
  detail,
  brandName,
  marketedBy,
  mrp,
  logoSrc,
  size = "md",
  className,
}: ThemedPackProps) {
  const t = brandThemeOf(theme);
  const s = sizes[size];
  const dark = t.dark;
  return (
    <div
      aria-hidden
      className={cn(
        "mx-auto overflow-hidden rounded-[8%/5%] border border-line shadow-card",
        s.box,
        className,
      )}
    >
      <div className={cn("flex items-center font-heading font-extrabold", headers[t.key], s.head)}>
        {logoSrc ? (
          // Plain <img>: a private route or a local preview serves it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" className={cn("rounded-full bg-white object-contain", s.mark)} />
        ) : (
          <span className={cn("grid place-items-center rounded-full bg-white text-[0.55em] text-orange-ink", s.mark)}>YB</span>
        )}
        <span className="min-w-0 truncate">{brandName || text.packBrand}</span>
      </div>
      <div className={cn("flex flex-col", t.pack, dark ? "text-ink" : "text-white", s.body)}>
        <small className={cn("font-bold tracking-[0.2em] uppercase", s.kicker)}>{text.packKicker}</small>
        <b className={cn("font-heading leading-[1.05] font-extrabold break-words", s.title)}>{name}</b>
        <span aria-hidden className="mt-2 h-0.5 w-1/5 bg-orange" />
        <span className={s.detail}>{detail}</span>
      </div>
      <div className={cn("flex items-center justify-between gap-2", dark ? "bg-surface-alt text-ink" : "bg-brand-dark text-white", s.foot)}>
        <span className="min-w-0 truncate">{marketedBy ? copy.launch.preview.marketedBy(marketedBy) : text.packMarketed}</span>
        <b className="shrink-0 font-heading font-extrabold">{mrp ?? text.packMrp}</b>
      </div>
    </div>
  );
}
