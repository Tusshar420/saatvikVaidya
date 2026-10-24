import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/cn";
import { portalPages } from "@/content/portal-pages";
import { portalCardClasses } from "../portal/page-hero";

const copy = portalPages.doctorTalk;

/**
 * Dr. Talk side column (`.portal-sidebar`): Verified Doctors (empty until
 * verification opens), the discussion standard note, and Dr. Talks videos.
 */
export function DoctorTalkSidebar({
  icons,
}: {
  icons: { doctors: ReactNode; standard: ReactNode; talks: ReactNode };
}) {
  return (
    <aside className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-1">
      <section
        aria-labelledby="doctors-title"
        className={cn(portalCardClasses, "p-6.5 md:col-span-2 lg:col-span-1")}
      >
        <h2 id="doctors-title" className="text-h3 text-ink">
          {copy.doctorsTitle}
        </h2>
        <p className="mt-1.5 text-small text-muted">{copy.doctorsText}</p>
        <div className="mt-5 flex items-start gap-3 rounded-[13px] border border-line p-3">
          <IconTile tone="brand">{icons.doctors}</IconTile>
          <p className="text-small text-muted">{copy.doctorsSoon}</p>
        </div>
      </section>

      <section
        aria-labelledby="standard-title"
        className="rounded-lg border border-gold/40 bg-gold-soft p-4.5"
      >
        <h2
          id="standard-title"
          className="flex items-center gap-2 font-heading text-small font-extrabold text-gold-ink [&_svg]:size-4"
        >
          {icons.standard}
          {copy.standardTitle}
        </h2>
        <p className="mt-2 text-[13px] leading-normal text-gold-ink">
          {copy.standardText}
        </p>
      </section>

      <section
        aria-labelledby="talks-title"
        className={cn(portalCardClasses, "p-6.5")}
      >
        <Badge variant="gold">{portalPages.comingNext}</Badge>
        <h2
          id="talks-title"
          className="mt-3 flex items-center gap-2 text-h4 text-ink [&_svg]:size-5 [&_svg]:text-brand"
        >
          {copy.talksTitle}
          {icons.talks}
        </h2>
        <p className="mt-1.5 text-small text-muted">{copy.talksText}</p>
      </section>
    </aside>
  );
}
