import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { TrackOrderForm } from "@/components/site/orders/track-order-form";
import { Eyebrow } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { orders as copy } from "@/content/orders";
import { telHref } from "@/lib/phone";
import { getSetting } from "@/server/content/settings";

const text = copy.track;

export const metadata: Metadata = { title: text.metaTitle };

/** Track an order without signing in: order number plus the phone or email on it. */
export default async function TrackPage() {
  const phone = await getSetting("contact.phone");
  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>{text.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">
          {text.title} <em className="block text-orange-title not-italic">{text.titleEmphasis}</em>
        </h1>
        <p className="mt-3 text-body-lg text-muted">{text.description}</p>

        <Card className="mt-8">
          <TrackOrderForm headingLevel="h2" />
        </Card>

        <p className="mt-6 text-sm text-muted">
          {text.signedInHint}{" "}
          <Link href="/orders" className="font-bold text-brand underline-offset-4 hover:underline">
            {text.myOrders}
          </Link>
          .
        </p>
        <p className="mt-1 text-sm text-muted">
          {text.helpLead}{" "}
          <a
            href={telHref(phone)}
            className="inline-flex min-h-11 items-center gap-1.5 font-bold text-brand underline-offset-4 hover:underline"
          >
            <Phone aria-hidden className="size-4" />
            {text.call(phone)}
          </a>
        </p>
      </div>
    </div>
  );
}
