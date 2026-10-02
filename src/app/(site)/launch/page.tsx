import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, PackageSearch, Phone, Search } from "lucide-react";
import { saveBrandAddressAction, placeBrandOrderAction } from "@/app/(site)/launch/actions";
import { ChooseProductButton } from "@/components/site/brand/choose-product-button";
import { LogoPreview } from "@/components/site/brand/logo-preview";
import { PackagingForm } from "@/components/site/brand/packaging-form";
import { QuantityForm } from "@/components/site/brand/quantity-form";
import { ProductVisual } from "@/components/site/catalogue/product-visual";
import { CheckoutForm } from "@/components/site/checkout/checkout-form";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { Button, ButtonArrow, buttonClasses } from "@/components/ui/button";
import { FormAlert } from "@/components/site/auth/form-alert";
import { ComingSoon, EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { brand as copy } from "@/content/brand";
import { checkout as checkoutCopy } from "@/content/checkout";
import { checkoutOff as paused } from "@/content/maintenance";
import { launchStepNumber } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import {
  furthestStep,
  listBrandProducts,
  readDraft,
  type BrandDraftView,
  type BrandProduct,
} from "@/server/brand/drafts";
import { brandTotals } from "@/server/brand/orders";
import { listAddresses } from "@/server/checkout/addresses";
import { getSetting } from "@/server/content/settings";
import { paymentsAvailable } from "@/server/payments";

export const metadata: Metadata = {
  title: copy.launch.metaTitle,
  robots: { index: false, follow: false },
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Launch Your Brand (P2.1, sign-in required): order a product in your own
 * packaging in four steps, saved as a draft after each one. A step can only
 * open once the steps before it are done; anything else goes back to the
 * furthest step allowed.
 */
export default async function LaunchPage({ searchParams }: PageProps<"/launch">) {
  const params = await searchParams;
  const requested = launchStepNumber(params.step);
  const { user } = await requireUser(requested > 1 ? `/launch?step=${requested}` : "/launch");
  const draft = await readDraft(user.id);
  const allowed = furthestStep(draft);
  if (requested > allowed) redirect(allowed > 1 ? `/launch?step=${allowed}` : "/launch");
  const step = requested;

  return (
    <div className="shell py-8 sm:py-12">
      <Eyebrow>{copy.launch.eyebrow}</Eyebrow>
      <h1 className="mt-2 text-h2 text-ink">
        {copy.launch.title} <em className="block text-teal not-italic">{copy.launch.titleEmphasis}</em>
      </h1>
      <p className="mt-3 max-w-2xl text-body-lg text-muted">{copy.launch.intro}</p>

      <Stepper
        label={copy.launch.stepsLabel}
        steps={copy.launch.steps.map((label) => ({ label }))}
        current={step - 1}
        className="mt-8 max-w-2xl"
      />

      <section aria-labelledby="launch-step-title" className="mt-8">
        <p className="text-label text-teal uppercase">
          {copy.launch.stepOf(step, copy.launch.steps.length)}
        </p>
        {step === 1 && <ProductStep draft={draft} q={first(params.q)} form={first(params.form)} />}
        {step === 2 && draft?.product && <PackagingStep draft={draft} />}
        {step === 3 && draft?.product && <QuantityStep draft={draft} product={draft.product} />}
        {step === 4 && draft?.product && (
          <ReviewStep draft={draft} product={draft.product} userId={user.id} />
        )}
      </section>
    </div>
  );
}

function StepHeading({ title, line }: { title: string; line: string }) {
  return (
    <>
      <h2 id="launch-step-title" className="mt-1 text-h3 text-ink">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-body text-muted">{line}</p>
    </>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────────────

async function ProductStep({
  draft,
  q,
  form,
}: {
  draft: BrandDraftView | null;
  q: string | undefined;
  form: string | undefined;
}) {
  const query = q?.trim().slice(0, 100) || undefined;
  const listing = await listBrandProducts({ q: query, form });
  const formKey = listing.forms.some((option) => option.key === form) ? form : undefined;
  const chosenId = draft?.product?.id ?? null;
  const text = copy.product;
  const href = (next: { form?: string }) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (next.form) search.set("form", next.form);
    const value = search.toString();
    return value ? `/launch?${value}` : "/launch";
  };

  if (listing.totalEligible === 0) {
    return (
      <>
        <StepHeading title={text.title} line={text.line} />
        <EmptyState
          as="h3"
          icon={<PackageSearch aria-hidden />}
          title={text.none.title}
          description={text.none.line}
          className="mt-6 max-w-2xl"
        />
      </>
    );
  }

  return (
    <>
      <StepHeading title={text.title} line={text.line} />
      {draft?.productGone && <FormAlert className="mt-4 max-w-2xl">{text.errors.product}</FormAlert>}
      {draft?.product && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-teal/40 bg-teal-soft/50 p-3.5">
          <p className="min-w-0 flex-1 text-sm text-ink">
            <span className="font-extrabold">{text.chosen}:</span> {draft.product.name}
          </p>
          <Link href="/launch?step=2" className={buttonClasses({ size: "sm" })}>
            {copy.launch.continue}
            <ButtonArrow />
          </Link>
        </div>
      )}

      <form method="get" action="/launch" role="search" aria-label={text.searchLabel} className="mt-5 flex max-w-xl gap-2">
        {formKey && <input type="hidden" name="form" value={formKey} />}
        <label htmlFor="launch-q" className="sr-only">
          {text.searchLabel}
        </label>
        <span className="relative block min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted"
          />
          <input
            id="launch-q"
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder={text.searchPlaceholder}
            maxLength={100}
            className={cn(inputClasses, "pl-10")}
          />
        </span>
        <Button type="submit" variant="secondary">
          {text.search}
        </Button>
      </form>

      {listing.forms.length > 1 && (
        <nav aria-label={text.formsLabel} className="mt-4">
          <ul className="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1 py-1">
            {[{ key: undefined, name: text.allForms }, ...listing.forms].map((option) => {
              const current = formKey === option.key;
              return (
                <li key={option.key ?? "all"} className="shrink-0">
                  <Link
                    href={href({ form: option.key })}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-sm border px-3.5 text-sm font-semibold whitespace-nowrap transition",
                      current
                        ? "border-teal bg-teal-soft font-extrabold text-teal"
                        : "border-line bg-surface text-ink hover:border-teal/60",
                    )}
                  >
                    {option.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {listing.products.length === 0 ? (
        <p className="mt-6 text-body text-muted">{text.empty}</p>
      ) : (
        <ul aria-label={text.listLabel} className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {listing.products.map((product) => (
            <ProductChoice key={product.id} product={product} chosen={product.id === chosenId} />
          ))}
        </ul>
      )}
    </>
  );
}

function ProductChoice({ product, chosen }: { product: BrandProduct; chosen: boolean }) {
  const text = copy.product;
  const { terms } = product;
  return (
    <li
      className={cn(
        "flex min-w-0 gap-3 rounded-lg border bg-surface p-3 shadow-card sm:p-4",
        chosen ? "border-teal" : "border-line",
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface-alt">
        <ProductVisual image={product.image} glyph={product.glyph} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-[15px] leading-snug font-bold text-ink sm:text-base">{product.name}</h3>
        <p className="text-small text-muted">
          {product.formName} · {product.packSize}
        </p>
        <p className="text-sm font-extrabold text-ink">
          {text.price(formatPaise(terms.unitPricePaise))}
          <span className="block text-small font-medium text-muted">{text.priceNote}</span>
        </p>
        <p className="text-small font-bold text-teal">
          {text.minimum(terms.minQty, terms.unitLabel)}
          {terms.minQty > 1 && <span className="block font-medium text-muted">{text.steps(terms.minQty)}</span>}
        </p>
        {chosen && <Badge variant="teal" className="w-fit">{text.chosen}</Badge>}
        <div className="mt-auto pt-2">
          <ChooseProductButton productId={product.id} productName={product.name} chosen={chosen} />
        </div>
      </div>
    </li>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────────────

function draftLogoProps(draft: BrandDraftView) {
  if (!draft.logo) return null;
  return {
    // The time busts the browser's copy after a replacement.
    src: `/api/launch/logo?v=${draft.updatedAt.getTime()}`,
    name: draft.logo.name,
    contentType: draft.logo.contentType,
    sizeBytes: draft.logo.sizeBytes,
  };
}

function PackagingStep({ draft }: { draft: BrandDraftView }) {
  return (
    <>
      <StepHeading title={copy.packaging.title} line={copy.packaging.line} />
      <div className="mt-6 max-w-3xl rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <PackagingForm initial={{ ...draft.packaging }} logo={draftLogoProps(draft)} />
      </div>
    </>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────────────

async function QuantityStep({ draft, product }: { draft: BrandDraftView; product: BrandProduct }) {
  const shipping = await getSetting("checkout.shipping");
  return (
    <>
      <StepHeading title={copy.quantity.title} line={product.name} />
      <div className="mt-6">
        <QuantityForm
          productName={product.name}
          terms={product.terms}
          gstRate={product.gstRate}
          shipping={shipping}
          initial={draft.quantity}
        />
      </div>
    </>
  );
}

// ─── Step 4 ─────────────────────────────────────────────────────────────────

function ReviewCard({
  title,
  editStep,
  children,
}: {
  title: string;
  editStep: number;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        <Link
          href={editStep > 1 ? `/launch?step=${editStep}` : "/launch"}
          aria-label={copy.launch.editLabel(title)}
          className="inline-flex min-h-11 items-center text-sm font-bold text-teal hover:underline"
        >
          {copy.launch.edit}
        </Link>
      </div>
      <div className="mt-2 text-sm text-ink">{children}</div>
    </section>
  );
}

async function ReviewStep({
  draft,
  product,
  userId,
}: {
  draft: BrandDraftView;
  product: BrandProduct;
  userId: string;
}) {
  const [shipping, addresses, phone, checkoutSwitch] = await Promise.all([
    getSetting("checkout.shipping"),
    listAddresses(userId),
    getSetting("contact.phone"),
    getSetting("checkout.enabled"),
  ]);
  const quantity = draft.quantity ?? product.terms.minQty;
  const totals = brandTotals(product.terms, product.gstRate, quantity, shipping);
  const text = copy.review;
  const packaging = draft.packaging;
  const logo = draftLogoProps(draft);
  const details: [string, string | null][] = [
    [copy.detail.brandName, packaging.brandName],
    [copy.detail.tagline, packaging.tagline],
    [
      copy.detail.marketedBy,
      [packaging.marketedByName, packaging.marketedByAddress].filter(Boolean).join(", ") || null,
    ],
    [copy.detail.contactPhone, packaging.contactPhone],
    [copy.detail.notes, packaging.notes],
  ];

  return (
    <>
      <StepHeading title={text.title} line={text.line} />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ReviewCard title={text.product} editStep={1}>
          <p className="font-bold">{product.name}</p>
          <p className="text-muted">
            {product.formName} · {product.packSize}
          </p>
        </ReviewCard>
        <ReviewCard title={text.packaging} editStep={2}>
          <div className="flex flex-col gap-3">
            {logo ? (
              <LogoPreview {...logo} alt={copy.packaging.logo.previewAlt(packaging.brandName ?? "")} />
            ) : (
              <p className="text-muted">{text.noLogo}</p>
            )}
            <dl className="flex flex-col gap-1.5">
              {details.map(([label, value]) =>
                value ? (
                  <div key={label} className="min-w-0">
                    <dt className="text-small font-bold text-muted">{label}</dt>
                    <dd className="break-words whitespace-pre-line">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </div>
        </ReviewCard>
        <ReviewCard title={text.quantity} editStep={3}>
          <p className="font-bold">{text.units(quantity, product.terms.unitLabel)}</p>
          <p className="text-muted">{copy.product.price(formatPaise(product.terms.unitPricePaise))}</p>
        </ReviewCard>
      </div>

      {!checkoutSwitch.enabled ? (
        <EmptyState
          as="h3"
          icon={<CreditCard aria-hidden />}
          title={paused.title}
          description={paused.body}
          className="mt-8 max-w-2xl"
        />
      ) : (
        <CheckoutForm
          addresses={addresses}
          checkoutKey={randomUUID()}
          totals={totals}
          coinOffer={null}
          items={[
            {
              key: product.id,
              name: product.name,
              detail: text.itemDetail(quantity, product.terms.unitLabel, formatPaise(product.terms.unitPricePaise)),
              totalPaise: totals.subtotalPaise,
            },
          ]}
          placeAction={placeBrandOrderAction}
          saveAddress={saveBrandAddressAction}
          placeLabel={text.place}
          placeNote={text.note}
          paymentsOff={
            paymentsAvailable() ? null : (
              <ComingSoon
                icon={<CreditCard aria-hidden />}
                title={checkoutCopy.paymentsOff.title}
                description={checkoutCopy.paymentsOff.line(phone)}
                as="h3"
                className="px-4 py-6"
                action={
                  <a href={telHref(phone)} className={buttonClasses({ variant: "secondary" })}>
                    <Phone aria-hidden className="size-4" />
                    {phone}
                  </a>
                }
              />
            )
          }
        />
      )}
    </>
  );
}
