import { Building2, Phone, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/phone";
import { portalPages } from "@/content/portal-pages";
import { PortalSectionTitle, portalCardClasses } from "../portal/page-hero";

const copy = portalPages.partner;

const pathwayIcons: Record<(typeof copy.pathways)[number]["key"], LucideIcon> =
  {
    distributor: Truck,
    pharmacy: ShoppingBag,
    institutional: Building2,
  };

/** The three partnership pathway cards (`.partner-grid`). */
export function PathwayCards() {
  return (
    <ul className="grid gap-3.75 sm:grid-cols-2 lg:grid-cols-3">
      {copy.pathways.map((p) => {
        const Icon = pathwayIcons[p.key];
        return (
          <li key={p.key} className={cn(portalCardClasses, "p-6.25")}>
            <IconTile tone="brand" size="lg">
              <Icon />
            </IconTile>
            <h3 className="mt-5.25 mb-1.75 text-h4 text-ink">{p.title}</h3>
            <p className="text-small text-muted">{p.text}</p>
            <a
              href="#callback"
              className="mt-2 inline-flex min-h-11 items-center text-small font-extrabold text-brand hover:underline"
            >
              {p.link} →
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Request a callback" (`.partner-form`). The secure server action and the
 * PartnerLead table come later in U.13; until then the form is shown
 * disabled with a clear coming-soon note and a way to call.
 */
export function CallbackCard({ phone }: { phone: string }) {
  const f = copy.fields;
  const labelClass = "mb-1.5 block text-xs font-extrabold text-ink";
  return (
    <section
      id="callback"
      aria-labelledby="callback-title"
      className={cn(portalCardClasses, "mt-5.5 scroll-mt-40 p-7 max-sm:p-4.5")}
    >
      <PortalSectionTitle
        id="callback-title"
        title={copy.formTitle}
        text={copy.formText}
        action={<Badge variant="brand">{copy.responseTime}</Badge>}
      />
      <p
        role="note"
        className="mb-4 flex items-start gap-2 rounded-md bg-gold-soft p-3 text-sm text-gold-ink"
      >
        <Badge variant="soon" className="shrink-0">
          {portalPages.comingNext}
        </Badge>
        <span>{copy.soonNote(phone)}</span>
      </p>
      <form aria-labelledby="callback-title">
        <fieldset disabled className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label htmlFor="partner-name" className={labelClass}>
              {f.name}
            </label>
            <input
              id="partner-name"
              className={inputClasses}
              placeholder={f.namePlaceholder}
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="partner-mobile" className={labelClass}>
              {f.mobile}
            </label>
            <input
              id="partner-mobile"
              className={inputClasses}
              placeholder={f.mobilePlaceholder}
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
            />
          </div>
          <div>
            <label htmlFor="partner-type" className={labelClass}>
              {f.type}
            </label>
            <select id="partner-type" className={inputClasses} defaultValue="">
              <option value="">{f.typePlaceholder}</option>
              {copy.pathways.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="partner-city" className={labelClass}>
              {f.city}
            </label>
            <input
              id="partner-city"
              className={inputClasses}
              placeholder={f.cityPlaceholder}
              autoComplete="address-level2"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="partner-message" className={labelClass}>
              {f.message}
            </label>
            <textarea
              id="partner-message"
              rows={3}
              className={cn(inputClasses, "h-auto min-h-19 py-3")}
              placeholder={f.messagePlaceholder}
            />
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            className={buttonClasses()}
          >
            {copy.submit}
          </button>
          <a
            href={telHref(phone)}
            className={buttonClasses({ variant: "secondary" })}
          >
            <Phone aria-hidden className="size-4" />
            {copy.call(phone)}
          </a>
        </div>
      </form>
    </section>
  );
}
