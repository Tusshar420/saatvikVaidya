import Link from "next/link";
import { inventory as copy } from "@/content/inventory";
import { cn } from "@/lib/cn";

const tabClasses =
  "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-0.5 text-sm font-extrabold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-orange after:transition-opacity focus-visible:-outline-offset-2";

/** The two inventories as underline tabs (links: each is its own page). */
export function InventoryTabs({ active }: { active: "b2c" | "b2b" }) {
  const tabs = [
    { key: "b2c", href: "/admin/inventory/b2c", label: copy.tabs.b2c },
    { key: "b2b", href: "/admin/inventory/b2b", label: copy.tabs.b2b },
  ] as const;
  return (
    <nav aria-label={copy.tabs.label} className="mt-6">
      <ul className="scrollbar-none flex gap-5 overflow-x-auto border-b border-line">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.key === active ? "page" : undefined}
              className={cn(
                tabClasses,
                tab.key === active ? "text-orange-ink after:opacity-100" : "text-muted after:opacity-0 hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
