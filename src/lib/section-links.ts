import type { HomeSectionId } from "@/content/shell";

/**
 * Homepage sections that also have a page of their own. Links to these
 * sections (nav rail, footer, admin-entered "/#launch") open the page, so a
 * section anchor never stands in for a real page.
 */
export const sectionPages: Partial<Record<HomeSectionId, string>> = {
  launch: "/launch",
};

/** Where a link to a homepage section goes: its page, or the "/#id" anchor. */
export function sectionHref(id: HomeSectionId): string {
  return sectionPages[id] ?? `/#${id}`;
}

/**
 * Points a homepage anchor link ("/#launch", "#launch") at the section's page
 * when it has one. Every other link comes back unchanged.
 */
export function pageForSectionLink(href: string): string {
  const match = /^\/?#([\w-]+)$/.exec(href);
  if (!match) return href;
  const page = (sectionPages as Record<string, string | undefined>)[match[1]];
  return page ?? href;
}
