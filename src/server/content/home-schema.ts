import { z } from "zod";

// Shapes for the homepage's JSON columns and link targets. Shared by
// getHomeContent() (which validates what it reads) and the seed (which
// validates what it writes). No "server-only" import: the seed runs under tsx.

/** Homepage sections, in their default order. */
export const homeSectionKeys = [
  "hero",
  "trust",
  "reels",
  "offers",
  "quick-actions",
  "launch",
  "brands",
  "courses",
  "coins",
  "quiz",
  "feedback",
  "community",
  // The mockup's profile-completion banner; it carries the #partner anchor.
  "partner",
  "why",
] as const;

export type HomeSectionKey = (typeof homeSectionKeys)[number];

export function isHomeSectionKey(value: string): value is HomeSectionKey {
  return (homeSectionKeys as readonly string[]).includes(value);
}

export const siteModals = ["sign-in", "track-order"] as const;
export type SiteModal = (typeof siteModals)[number];

/**
 * A path on this site, such as "/coins", "/#brands" or "/media/x.jpg". Rejects
 * other origins, protocol-relative "//" URLs, backslashes and "javascript:".
 */
export const sitePathSchema = z
  .string()
  .max(200)
  .regex(/^\/(?![/\\])[^\s\\]*$/);

/** Where a link may point: a site path, or a site modal ("modal:sign-in"). */
export const linkTargetSchema = z.union([
  sitePathSchema,
  z.templateLiteral(["modal:", z.enum(siteModals)]),
]);

export type LinkTarget = z.infer<typeof linkTargetSchema>;

const text = (max: number) => z.string().trim().min(1).max(max);

const labelled = z.object({ label: text(40), value: text(80) });

// ─── Hero panels (HeroSlide.panel, chosen by HeroSlide.panelKind) ──────────

export const launchStudioPanelSchema = z.object({
  label: text(40),
  step: text(40),
  title: text(120),
  searchPlaceholder: text(60),
  pills: z.array(text(30)).min(1).max(6),
  selectedPill: text(30),
  product: z.object({
    symbol: text(4),
    name: text(80),
    meta: text(80),
  }),
  meta: z.array(labelled).min(1).max(3),
  nextLabel: text(60),
  nextHref: linkTargetSchema.nullable(),
  note: text(80),
});

export const brandShowcasePanelSchema = z.object({
  floatLabel: text(60),
  featured: z.object({
    eyebrow: text(40),
    name: text(60),
    description: text(120),
    linkLabel: text(40),
    linkHref: linkTargetSchema.nullable(),
  }),
  others: z.array(z.object({ name: text(60), description: text(80) })).max(3),
});

export const learningBoardPanelSchema = z.object({
  badge: text(40),
  title: text(120),
  subtitle: text(160),
  meta: z.array(labelled).min(1).max(3),
  speaker: z.object({ initials: text(3), name: text(80), role: text(80) }),
  linkLabel: text(60),
  linkHref: linkTargetSchema.nullable(),
});

export const heroPanelSchemas = {
  LAUNCH_STUDIO: launchStudioPanelSchema,
  BRAND_SHOWCASE: brandShowcasePanelSchema,
  LEARNING_BOARD: learningBoardPanelSchema,
} as const;

export type HeroPanel =
  | ({ kind: "LAUNCH_STUDIO" } & z.infer<typeof launchStudioPanelSchema>)
  | ({ kind: "BRAND_SHOWCASE" } & z.infer<typeof brandShowcasePanelSchema>)
  | ({ kind: "LEARNING_BOARD" } & z.infer<typeof learningBoardPanelSchema>);

/** HeroSlide.proof: the "DR AV +" faces row with its two lines. */
export const heroProofSchema = z.object({
  initials: z.array(text(3)).min(1).max(4),
  title: text(80),
  subtitle: text(120),
});

export type HeroProof = z.infer<typeof heroProofSchema>;

// ─── Section content (HomeSection.content), for sections that need it ──────

export const sectionContentSchemas = {
  reels: z.object({
    /** Filter chip labels: "all" plus one per ReelType. */
    filters: z.object({
      all: text(30),
      PRODUCT: text(30),
      FEEDBACK: text(30),
      LEARNING: text(30),
      OFFER: text(30),
    }),
  }),
  launch: z.object({
    steps: z
      .array(z.object({ title: text(80), body: text(160) }))
      .min(1)
      .max(6),
    catalogue: z.object({
      eyebrow: text(40),
      title: text(80),
      filtersLabel: text(30),
      searchPlaceholder: text(60),
      formTab: text(30),
      practiceAreaTab: text(30),
      categoryLinkLabel: text(40),
    }),
  }),
  coins: z.object({
    equation: z.object({ coins: text(20), value: text(20), note: text(80) }),
  }),
  quiz: z.object({
    badge: text(40),
    question: z.object({ label: text(40), text: text(200), timer: text(10) }),
    note: text(80),
  }),
  community: z.object({
    points: z.array(text(120)).min(1).max(6),
  }),
  partner: z.object({
    completion: z.object({
      label: text(40),
      rewardLabel: text(40),
      /** The mockup's sample figure, shown before real profile data exists. */
      examplePercent: z.number().int().min(0).max(100),
      steps: z
        .array(
          z.object({
            key: text(40),
            label: text(80),
            coins: z.number().int().min(0),
            exampleDone: z.boolean(),
          }),
        )
        .min(1)
        .max(8),
      note: text(160),
    }),
  }),
} satisfies Partial<Record<HomeSectionKey, z.ZodType>>;

export type SectionContentKey = keyof typeof sectionContentSchemas;

export type SectionContent<K extends SectionContentKey> = z.infer<
  (typeof sectionContentSchemas)[K]
>;
