import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Cache tags for content reads. Whatever changes this data later (the admin
 * panel) calls revalidateTag(tag, "max") so pages pick up the change at once.
 */
export const contentTags = {
  settings: "content:settings",
  home: "content:home",
} as const;

export type ContentTag = (typeof contentTags)[keyof typeof contentTags];

/**
 * Until the admin panel calls revalidateTag, content edited straight in the
 * database shows up within this many seconds.
 */
export const contentRevalidateSeconds = 300;

/**
 * Wraps a database read in Next's data cache, shared across requests and
 * tagged for on-demand revalidation. The result must be JSON-serialisable
 * (no Date or BigInt), because that's how the cache stores it.
 *
 * This uses unstable_cache because the app doesn't enable Cache Components.
 * If it does later, swap this body for a "use cache" function with
 * cacheTag/cacheLife; callers don't change.
 */
export function cachedRead<T>(
  read: () => Promise<T>,
  key: string,
  tag: ContentTag,
): () => Promise<T> {
  return unstable_cache(read, [key], {
    tags: [tag],
    revalidate: contentRevalidateSeconds,
  });
}
