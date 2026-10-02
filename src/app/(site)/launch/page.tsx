import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, PackageSearch, Phone, Search, X } from "lucide-react";
import { saveBrandAddressAction, placeBrandOrderAction } from "@/app/(site)/launch/actions";
import { LaunchFilterPanel } from "@/components/site/brand/launch-filters";
import { ChooseProductButton } from "@/components/site/brand/choose-product-button";
import { LogoPreview } from "@/components/site/brand/logo-preview";
import { PackagingForm } from "@/components/site/brand/packaging-form";
import { QuantityForm } from "@/components/site/brand/quantity-form";
import { CataloguePagination } from "@/components/site/catalogue/catalogue-pagination";
import { FormChips } from "@/components/site/catalogue/form-chips";
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
import { launchHref, launchStepNumber } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import {
  brandFiltersSchema,
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
        {step === 1 && <ProductStep draft={draft} params={params} />}
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
  params,
}: {
  draft: BrandDraftView | null;
  params: Record<string, string | string[] | undefined>;
}) {
  const listing = await listBrandProducts(brandFiltersSchema.parse(params));
  const { filters, products } = listing;
  const chosenId = draft?.product?.id ?? null;
  const text = copy.product;
  const filterText = text.filters;
  const hrefFor = (next: Partial<Record<keyof typeof filters, string | number | undefined>>) =>
    launchHref({ ...filters, ...next, page: undefined });

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

  const nameOf = (options: { key: string; name: string }[], key?: string) =>
    options.find((option) => option.key === key)?.name;
  const rupees = (n: number) => formatPaise(n * 100);
  const priceChip =
    filters.minPrice !== undefined && filters.maxPrice !== undefined
      ? filterText.priceRange(rupees(filters.minPrice), rupees(filters.maxPrice))
      : filters.minPrice !== undefined
        ? filterText.priceFrom(rupees(filters.minPrice))
        : filters.maxPrice !== undefined
          ? filterText.priceUpTo(rupees(filters.maxPrice))
          : undefined;
  const chips = (
    [
      [["q"], filters.q && filterText.search(filters.q)],
      [["form"], nameOf(listing.forms, filters.form)],
      [["area"], nameOf(listing.areas, filters.area)],
      [["maker"], nameOf(listing.makers, filters.maker)],
      [["minPrice", "maxPrice"], priceChip],
    ] as [(keyof typeof filters)[], string | undefined][]
  ).filter((chip): chip is [(keyof typeof filters)[], string] => Boolean(chip[1]));
  const resultsLabel = filters.q ? text.resultsFor(listing.total, filters.q) : text.results(listing.total);

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
        {(["form", "area", "maker", "minPrice", "maxPrice", "sort"] as const).map(
          (name) =>
            filters[name] !== undefined &&
            !(name === "sort" && filters.sort === "featured") && (
              <input key={name} type="hidden" name={name} value={filters[name]} />
            ),
        )}
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
            defaultValue={filters.q ?? ""}
            placeholder={text.searchPlaceholder}
            maxLength={100}
            className={cn(inputClasses, "pl-10")}
          />
        </span>
        <Button type="submit" variant="secondary">
          {text.search}
        </Button>
      </form>

      <div className="mt-4">
        <FormChips
          forms={listing.forms}
          filters={filters}
          hrefFor={(form) => hrefFor({ form })}
          allLabel={text.allForms}
          label={text.formsLabel}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="lg:sticky lg:top-40 lg:self-start">
          <LaunchFilterPanel
            forms={listing.forms}
            areas={listing.areas}
            makers={listing.makers}
            filters={filters}
            priceRange={listing.priceRange}
            activeCount={chips.length}
          />
        </aside>

        <section aria-labelledby="launch-results" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3">
            <h3 id="launch-results" aria-live="polite" className="text-base font-extrabold text-ink">
              {resultsLabel}
            </h3>
            {chips.length > 0 && (
              <ul aria-label={filterText.active} className="flex flex-wrap gap-2">
                {chips.map(([names, label]) => (
                  <li key={names.join("-")}>
                    <Link
                      href={hrefFor(Object.fromEntries(names.map((name) => [name, undefined])))}
                      aria-label={filterText.remove(label)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-teal bg-teal-soft px-3 text-sm font-bold text-teal transition hover:bg-surface"
                    >
                      {label}
                      <X aria-hidden className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {products.length === 0 ? (
            <EmptyState
              as="h3"
              icon={<PackageSearch aria-hidden />}
              title={text.empty}
              action={
                <Link href="/launch" className={buttonClasses({ variant: "secondary" })}>
                  {text.clearAll}
                </Link>
              }
            />
          ) : (
            <>
              <ul aria-label={text.listLabel} className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductChoice key={product.id} product={product} chosen={product.id === chosenId} />
                ))}
              </ul>
              <CataloguePagination
                basePath="/launch"
                params={{ ...filters, page: undefined, sort: filters.sort === "featured" ? undefined : filters.sort, minPrice: filters.minPrice?.toString(), maxPrice: filters.maxPrice?.toString() }}
                page={listing.page}
                pageCount={listing.pageCount}
              />
            </>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * One product in the brand catalogue: the store card's picture-on-top
 * layout, but with the branded price, minimum order and step in a teal panel
 * (the retail price isn't shown) and a Choose button instead of Add to cart.
 */
function ProductChoice({ product, chosen }: { product: BrandProduct; chosen: boolean }) {
  const text = copy.product;
  const { terms } = product;
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border bg-surface shadow-card",
        chosen ? "border-teal" : "border-line",
      )}
    >
      <div className="relative aspect-4/3 overflow-hidden border-b border-line bg-surface-alt">
        <ProductVisual image={product.image} glyph={product.glyph} />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
          <Badge variant="teal">{text.catalogueTag}</Badge>
          {chosen && <Badge variant="live">{text.chosen}</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        {product.makerName && <p className="truncate text-label text-muted uppercase">{product.makerName}</p>}
        <h4 className="text-[15px] leading-snug font-bold text-ink sm:text-base">{product.name}</h4>
        <p className="text-small text-muted">
          {product.formName} · {product.packSize}
        </p>
        <div className="mt-2 rounded-md bg-teal-soft/60 p-2.5">
          <p className="text-sm font-extrabold text-ink">
            {text.price(formatPaise(terms.unitPricePaise))}
            <span className="block text-small font-medium text-muted">{text.priceNote}</span>
          </p>
          <p className="mt-1.5 text-small font-bold text-teal">
            {text.minimum(terms.minQty, terms.unitLabel)}
            {terms.minQty > 1 && <span className="block font-medium text-muted">{text.steps(terms.minQty)}</span>}
          </p>
        </div>
        <div className="mt-auto pt-3">
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
