import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreditCard,
  PackageSearch,
  Phone,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  saveBrandAddressAction,
  placeBrandOrderAction,
} from "@/app/(site)/launch/actions";
import { AddToLaunchCart } from "@/components/site/brand/add-to-launch-cart";
import { BrandProfiles } from "@/components/site/brand/brand-profiles";
import { LabelDetailsForm } from "@/components/site/brand/label-details-form";
import { LaunchCartLineControls } from "@/components/site/brand/launch-cart-line-controls";
import { LaunchFilterPanel } from "@/components/site/brand/launch-filters";
import { LogoPreview } from "@/components/site/brand/logo-preview";
import { OrderSummary } from "@/components/site/cart/order-summary";
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
import { launchHref, launchStepNumber, nextBrandTier } from "@/lib/brand";
import { MAX_BRAND_PROFILES, specFields } from "@/lib/label";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import {
  brandCartTotals,
  furthestStep,
  readBrandCart,
  type BrandCartLine,
  type BrandCartView,
} from "@/server/brand/cart";
import {
  brandFiltersSchema,
  listBrandProducts,
  readDraft,
  type BrandDraftView,
  type BrandProduct,
} from "@/server/brand/drafts";
import { readLabelLines } from "@/server/brand/labels";
import {
  chosenProfile,
  listProfiles,
  type BrandProfileView,
} from "@/server/brand/profiles";
import { listAddresses } from "@/server/checkout/addresses";
import { getSetting } from "@/server/content/settings";
import { paymentsAvailable } from "@/server/payments";

export const metadata: Metadata = {
  title: copy.launch.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * Launch Your Brand (P2.1, sign-in required): order products in your own
 * packaging in four steps. Products go into the Launch cart (step 1), their
 * quantities are set there (step 2), the packaging is added once for the
 * whole order (step 3), then review and pay (step 4). The cart and the
 * packaging are saved to the account. A step can only open once the steps
 * before it are done (the cart itself always opens); anything else goes
 * back to the furthest step allowed.
 */
export default async function LaunchPage({
  searchParams,
}: PageProps<"/launch">) {
  const params = await searchParams;
  const requested = launchStepNumber(params.step);
  const { user } = await requireUser(
    requested > 1 ? `/launch?step=${requested}` : "/launch",
  );
  const [cart, draft, profiles] = await Promise.all([
    readBrandCart(user.id),
    readDraft(user.id),
    listProfiles(user.id),
  ]);
  const profile = chosenProfile(profiles, draft);
  const allowed = Math.max(2, furthestStep(cart, draft, profile));
  if (requested > allowed) redirect(`/launch?step=${allowed}`);
  const step = requested;

  return (
    <div className="shell py-8 sm:py-12">
      <Eyebrow>{copy.launch.eyebrow}</Eyebrow>
      <h1 className="mt-2 text-h2 text-ink">
        {copy.launch.title}{" "}
        <em className="block text-teal not-italic">
          {copy.launch.titleEmphasis}
        </em>
      </h1>
      <p className="mt-3 max-w-2xl text-body-lg text-muted">
        {copy.launch.intro}
      </p>

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
        {step === 1 && <ProductStep cart={cart} params={params} />}
        {step === 2 && <CartStep cart={cart} />}
        {step === 3 && (
          <PackagingStep
            userId={user.id}
            draft={draft}
            profiles={profiles}
            profile={profile}
          />
        )}
        {step === 4 && draft && profile && (
          <ReviewStep
            cart={cart}
            draft={draft}
            profile={profile}
            userId={user.id}
          />
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
  cart,
  params,
}: {
  cart: BrandCartView;
  params: Record<string, string | string[] | undefined>;
}) {
  const [listing, shipping] = await Promise.all([
    listBrandProducts(brandFiltersSchema.parse(params)),
    getSetting("checkout.shipping"),
  ]);
  const { filters, products } = listing;
  const inCart = new Map(
    cart.lines.map((line) => [line.productId, line.quantity]),
  );
  const text = copy.product;
  const filterText = text.filters;
  const hrefFor = (
    next: Partial<Record<keyof typeof filters, string | number | undefined>>,
  ) => launchHref({ ...filters, ...next, page: undefined });

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
      ? filterText.priceRange(
          rupees(filters.minPrice),
          rupees(filters.maxPrice),
        )
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
  ).filter((chip): chip is [(keyof typeof filters)[], string] =>
    Boolean(chip[1]),
  );
  const resultsLabel = filters.q
    ? text.resultsFor(listing.total, filters.q)
    : text.results(listing.total);

  return (
    <>
      <StepHeading title={text.title} line={text.line} />
      {cart.lines.length > 0 && (
        <section
          aria-label={text.cartBar.label}
          className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-teal/40 bg-teal-soft/50 p-3.5"
        >
          <ShoppingBag aria-hidden className="size-5 shrink-0 text-teal" />
          <p className="min-w-0 flex-1 text-sm text-ink">
            <span className="block font-extrabold">{text.cartBar.label}</span>
            {text.cartBar.summary(
              cart.lines.length,
              cart.units,
              formatPaise(brandCartTotals(cart, shipping).totalPaise),
            )}
          </p>
          <Link
            href="/launch?step=2"
            className={buttonClasses({
              size: "sm",
              className: "max-sm:w-full",
            })}
          >
            {text.cartBar.view}
            <ButtonArrow />
          </Link>
        </section>
      )}

      <form
        method="get"
        action="/launch"
        role="search"
        aria-label={text.searchLabel}
        className="mt-5 flex max-w-xl gap-2"
      >
        {(
          ["form", "area", "maker", "minPrice", "maxPrice", "sort"] as const
        ).map(
          (name) =>
            filters[name] !== undefined &&
            !(name === "sort" && filters.sort === "featured") && (
              <input
                key={name}
                type="hidden"
                name={name}
                value={filters[name]}
              />
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
            <h3
              id="launch-results"
              aria-live="polite"
              className="text-base font-extrabold text-ink"
            >
              {resultsLabel}
            </h3>
            {chips.length > 0 && (
              <ul
                aria-label={filterText.active}
                className="flex flex-wrap gap-2"
              >
                {chips.map(([names, label]) => (
                  <li key={names.join("-")}>
                    <Link
                      href={hrefFor(
                        Object.fromEntries(
                          names.map((name) => [name, undefined]),
                        ),
                      )}
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
                <Link
                  href="/launch"
                  className={buttonClasses({ variant: "secondary" })}
                >
                  {text.clearAll}
                </Link>
              }
            />
          ) : (
            <>
              <ul
                aria-label={text.listLabel}
                className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
              >
                {products.map((product) => (
                  <ProductChoice
                    key={product.id}
                    product={product}
                    inCart={inCart.get(product.id) ?? null}
                  />
                ))}
              </ul>
              <CataloguePagination
                basePath="/launch"
                params={{
                  ...filters,
                  page: undefined,
                  sort: filters.sort === "featured" ? undefined : filters.sort,
                  minPrice: filters.minPrice?.toString(),
                  maxPrice: filters.maxPrice?.toString(),
                }}
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
 * layout, but with the branded price, minimum order, step and best bulk
 * price in a teal panel (the retail price isn't shown), and "Add to launch
 * cart" instead of the store's Add to cart.
 */
function ProductChoice({
  product,
  inCart,
}: {
  product: BrandProduct;
  inCart: number | null;
}) {
  const text = copy.product;
  const { terms } = product;
  const best = terms.tiers.at(-1);
  const chosen = inCart !== null;
  // Fewer can be made than the minimum order: nothing can be ordered yet.
  const soldOut = product.makeable !== null && product.makeable < terms.minQty;
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
          {chosen && <Badge variant="orange">{text.inCart}</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        {product.makerName && (
          <p className="truncate text-label text-muted uppercase">
            {product.makerName}
          </p>
        )}
        <h4 className="text-[15px] leading-snug font-bold text-ink sm:text-base">
          {product.name}
        </h4>
        <p className="text-small text-muted">
          {product.formName} · {product.packSize}
        </p>
        <div className="mt-2 rounded-md bg-teal-soft/60 p-2.5">
          <p className="text-sm font-extrabold text-ink">
            {text.price(formatPaise(terms.unitPricePaise))}
            <span className="block text-small font-medium text-muted">
              {text.priceNote}
            </span>
          </p>
          <p className="mt-1.5 text-small font-bold text-teal">
            {text.minimum(terms.minQty, terms.unitLabel)}
            {terms.minQty > 1 && (
              <span className="block font-medium text-muted">
                {text.steps(terms.minQty)}
              </span>
            )}
          </p>
          {product.makeable !== null && (
            <p
              className={cn(
                "mt-1.5 text-small font-bold",
                soldOut ? "text-danger" : "text-green",
              )}
            >
              {soldOut
                ? text.outOfStock
                : text.available(product.makeable, terms.unitLabel)}
            </p>
          )}
          {best && (
            <p className="mt-1.5 text-small font-bold text-ink">
              {text.bulkFrom(
                best.minQty,
                terms.unitLabel,
                formatPaise(best.unitPricePaise),
              )}
            </p>
          )}
        </div>
        <div className="mt-auto pt-3">
          {soldOut && inCart === null ? (
            <p className="text-small font-medium text-muted">
              {text.outOfStockLine}
            </p>
          ) : (
            <AddToLaunchCart
              productId={product.id}
              productName={product.name}
              minQty={terms.minQty}
              unitLabel={terms.unitLabel}
              inCart={inCart}
            />
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────────────

async function CartStep({ cart }: { cart: BrandCartView }) {
  const text = copy.cart;
  if (cart.lines.length === 0) {
    return (
      <>
        <StepHeading title={text.title} line={text.line} />
        <EmptyState
          as="h3"
          icon={<ShoppingBag aria-hidden />}
          title={text.empty.title}
          description={text.empty.line}
          className="mt-6 max-w-2xl"
          action={
            <Link href="/launch" className={buttonClasses()}>
              {text.empty.browse}
            </Link>
          }
        />
      </>
    );
  }
  const shipping = await getSetting("checkout.shipping");
  const totals = brandCartTotals(cart, shipping);
  return (
    <>
      <StepHeading title={text.title} line={text.line} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          <ul aria-label={text.listLabel} className="flex flex-col gap-4">
            {cart.lines.map((line) => (
              <CartLine key={line.productId} line={line} />
            ))}
          </ul>
          {cart.overLimit && <FormAlert>{text.overLimit}</FormAlert>}
          <Link
            href="/launch"
            className="inline-flex min-h-11 items-center self-start text-sm font-bold text-teal hover:underline"
          >
            {text.addMore}
          </Link>
        </div>
        <OrderSummary
          title={text.summaryTitle}
          totals={totals}
          className="lg:sticky lg:top-40"
        >
          <p className="text-small text-muted">
            {text.count(cart.lines.length)}
          </p>
          {cart.ready ? (
            <Link
              href="/launch?step=3"
              className={buttonClasses({ className: "w-full" })}
            >
              {text.continue}
              <ButtonArrow />
            </Link>
          ) : (
            <Button disabled className="w-full">
              {text.continue}
            </Button>
          )}
        </OrderSummary>
      </div>
    </>
  );
}

/** One Launch cart line: price at this quantity, bulk tiers, quantity, line total. */
function CartLine({ line }: { line: BrandCartLine }) {
  const text = copy.cart;
  const product = line.product;
  const terms = product?.terms ?? null;
  const unit = terms?.unitLabel ?? "";
  const ruleId = `launch-rule-${line.productId}`;
  const next = terms && line.valid ? nextBrandTier(terms, line.quantity) : null;
  const bulk = terms !== null && line.unitPricePaise < terms.unitPricePaise;
  return (
    <li className="flex gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:gap-4 sm:p-5">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-alt sm:size-20">
        <ProductVisual
          image={product?.image ?? null}
          glyph={product?.glyph ?? null}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold break-words text-ink">
              {line.name}
            </h3>
            {product && (
              <p className="text-small text-muted">
                {product.formName} · {product.packSize}
              </p>
            )}
          </div>
          {product && (
            <p className="text-right">
              <span className="block text-small text-muted">
                {text.lineTotal}
              </span>
              <span className="text-base font-extrabold text-ink">
                {formatPaise(line.lineTotalPaise)}
              </span>
            </p>
          )}
        </div>

        {!product || !terms ? (
          <FormAlert>{text.unavailable}</FormAlert>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
              <span className="font-bold">
                {text.each(formatPaise(line.unitPricePaise))}
              </span>
              {bulk && <Badge variant="teal">{text.bulkApplied}</Badge>}
              <span id={ruleId} className="text-small text-muted">
                {text.steps(terms.minQty, unit)}
              </span>
            </p>
            {terms.tiers.length > 0 && (
              <ul
                aria-label={text.tiersLabel(line.name)}
                className="flex flex-wrap gap-1.5"
              >
                {[
                  {
                    minQty: terms.minQty,
                    unitPricePaise: terms.unitPricePaise,
                  },
                  ...terms.tiers,
                ].map((tier) => {
                  const current = tier.unitPricePaise === line.unitPricePaise;
                  return (
                    <li
                      key={tier.minQty}
                      className={cn(
                        "rounded-sm border px-2 py-1 text-small",
                        current
                          ? "border-teal bg-teal-soft font-bold text-teal"
                          : "border-line text-muted",
                      )}
                    >
                      {text.tier(
                        tier.minQty,
                        unit,
                        formatPaise(tier.unitPricePaise),
                      )}
                      {current && (
                        <span className="sr-only"> ({text.currentTier})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {next && (
              <p className="text-small font-medium text-ink">
                {text.nextTier(
                  next.unitsMore,
                  unit,
                  formatPaise(next.tier.unitPricePaise),
                )}
              </p>
            )}
            {line.overStock && product.makeable !== null ? (
              <FormAlert>{text.overStock(product.makeable, unit)}</FormAlert>
            ) : (
              !line.valid && <FormAlert>{text.invalid(terms.minQty)}</FormAlert>
            )}
          </>
        )}
        <LaunchCartLineControls
          productId={line.productId}
          name={line.name}
          quantity={line.quantity}
          terms={terms}
          unitLabel={unit}
          removeOnly={!product}
          describedBy={product ? ruleId : undefined}
        />
      </div>
    </li>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────────────

function profileLogoProps(profile: BrandProfileView | null) {
  if (!profile?.logo) return null;
  return {
    // The time busts the browser's copy after a replacement.
    src: `/api/launch/logo?profile=${profile.id}&v=${profile.updatedAt.getTime()}`,
    ...profile.logo,
  };
}

async function PackagingStep({
  userId,
  draft,
  profiles,
  profile,
}: {
  userId: string;
  draft: BrandDraftView | null;
  profiles: BrandProfileView[];
  profile: BrandProfileView | null;
}) {
  const lines = profile?.logo ? await readLabelLines(userId, profile) : [];
  return (
    <>
      <StepHeading title={copy.packaging.title} line={copy.packaging.line} />
      <div className="mt-6 flex max-w-4xl flex-col gap-8">
        <section
          aria-labelledby="launch-brands-title"
          className="flex flex-col gap-3"
        >
          <div>
            <h3 id="launch-brands-title" className="text-h3 text-ink">
              {copy.profiles.title}
            </h3>
            <p className="mt-1 text-body text-muted">{copy.profiles.line}</p>
          </div>
          <BrandProfiles
            profiles={profiles}
            selectedId={profile?.id ?? null}
            max={MAX_BRAND_PROFILES}
          />
        </section>
        {profile?.logo ? (
          <LabelDetailsForm
            // A new brand, or changes to it, start the label fields again from it.
            key={`${profile.id}-${profile.updatedAt.getTime()}-${lines.length}`}
            lines={lines.map((line) => ({
              productId: line.productId,
              name: line.name,
              spec: line.spec,
              defaults: line.defaults,
              trimmed: line.trimmed,
              values: line.values,
            }))}
            notes={draft?.notes ?? null}
          />
        ) : (
          profiles.length > 0 && (
            <p className="text-sm font-bold text-muted">
              {copy.packaging.errors.logo}
            </p>
          )
        )}
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
  cart,
  draft,
  profile,
  userId,
}: {
  cart: BrandCartView;
  draft: BrandDraftView;
  profile: BrandProfileView;
  userId: string;
}) {
  const [shipping, addresses, phone, checkoutSwitch, labelLines] =
    await Promise.all([
      getSetting("checkout.shipping"),
      listAddresses(userId),
      getSetting("contact.phone"),
      getSetting("checkout.enabled"),
      readLabelLines(userId, profile),
    ]);
  const totals = brandCartTotals(cart, shipping);
  const text = copy.review;
  const logo = profileLogoProps(profile);
  const details: [string, string | null][] = [
    [copy.detail.brandName, profile.brandName],
    [copy.detail.tagline, profile.tagline],
    [
      copy.detail.marketedBy,
      [profile.marketedByName, profile.marketedByAddress]
        .filter(Boolean)
        .join(", ") || null,
    ],
    [copy.detail.contactPhone, profile.contactPhone],
    [copy.detail.licenceNumbers, profile.licenceNumbers],
    [copy.detail.notes, draft.notes],
  ];
  const lines = cart.lines.flatMap((line) =>
    line.product ? [{ ...line, product: line.product }] : [],
  );

  return (
    <>
      <StepHeading title={text.title} line={text.line} />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ReviewCard title={text.products} editStep={2}>
          <ul className="flex flex-col divide-y divide-line">
            {lines.map((line) => (
              <li
                key={line.productId}
                className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="block font-bold break-words">
                    {line.name}
                  </span>
                  <span className="text-muted">
                    {text.itemDetail(
                      line.quantity,
                      line.product.terms.unitLabel,
                      formatPaise(line.unitPricePaise),
                    )}
                  </span>
                </span>
                <span className="shrink-0 font-bold">
                  {formatPaise(line.lineTotalPaise)}
                </span>
              </li>
            ))}
          </ul>
        </ReviewCard>
        <ReviewCard title={text.packaging} editStep={3}>
          <div className="flex flex-col gap-3">
            {logo ? (
              <LogoPreview
                {...logo}
                alt={copy.packaging.logo.previewAlt(profile.brandName)}
              />
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
        <ReviewCard title={copy.labels.review.title} editStep={3}>
          <ul className="flex flex-col divide-y divide-line">
            {labelLines.map((line) => {
              const edited = specFields(line.spec).filter(
                (field) => line.overrides[field] !== undefined,
              );
              return (
                <li key={line.productId} className="py-2 first:pt-0 last:pb-0">
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 flex-1 font-bold break-words">
                        {line.name}
                      </span>
                      {edited.length > 0 && (
                        <Badge variant="gold">
                          {copy.labels.review.edited}
                        </Badge>
                      )}
                    </summary>
                    <dl className="mt-2 flex flex-col gap-1.5">
                      {specFields(line.spec).map((field) =>
                        line.values[field] ? (
                          <div key={field} className="min-w-0">
                            <dt className="text-small font-bold text-muted">
                              {copy.labels.fields[field]}
                            </dt>
                            <dd className="break-words whitespace-pre-line">
                              {line.values[field]}
                            </dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  </details>
                </li>
              );
            })}
          </ul>
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
          items={lines.map((line) => ({
            key: line.productId,
            name: line.name,
            detail: text.itemDetail(
              line.quantity,
              line.product.terms.unitLabel,
              formatPaise(line.unitPricePaise),
            ),
            totalPaise: line.lineTotalPaise,
          }))}
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
                  <a
                    href={telHref(phone)}
                    className={buttonClasses({ variant: "secondary" })}
                  >
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
