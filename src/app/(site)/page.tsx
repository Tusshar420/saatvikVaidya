import { Eyebrow } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { placeholderHome } from "@/content/site";
import { navItems } from "@/content/shell";

// Placeholder until the homepage is rebuilt in chunks A7 and A8. It keeps one
// stub per nav-rail section so the rail's links and scroll-spy have targets.
export default function HomePage() {
  return (
    <>
      <section
        id="top"
        className="shell flex min-h-[60vh] flex-col justify-center gap-5 py-16"
      >
        <Eyebrow>{placeholderHome.eyebrow}</Eyebrow>
        <h1 className="max-w-3xl text-display text-ink">
          {placeholderHome.titleLead}
          <br />
          <em className="text-teal not-italic">
            {placeholderHome.titleEmphasis}
          </em>
        </h1>
        <p className="max-w-xl text-body-lg text-muted">
          {placeholderHome.body}
        </p>
      </section>
      {navItems.map((item, index) => (
        <section
          key={item.id}
          id={item.id}
          aria-labelledby={`${item.id}-title`}
          className={cn(
            "min-h-[70vh] section-y",
            index % 2 === 0 ? "bg-surface-alt" : "bg-surface",
          )}
        >
          <div className="shell">
            <h2 id={`${item.id}-title`} className="text-h2 text-ink">
              {item.label}
            </h2>
            <p className="mt-3 text-body text-muted">
              {placeholderHome.sectionNote}
            </p>
          </div>
        </section>
      ))}
    </>
  );
}
