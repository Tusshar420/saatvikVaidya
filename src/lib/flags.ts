type FlagEnv = Partial<Record<"NODE_ENV" | "SHOW_DESIGN_PAGE", string>>;

/**
 * The /design showcase is for the team only: on in development, and elsewhere
 * only with SHOW_DESIGN_PAGE=true (read at request time).
 */
export function isDesignPageEnabled(env: FlagEnv = process.env): boolean {
  return env.NODE_ENV === "development" || env.SHOW_DESIGN_PAGE === "true";
}
