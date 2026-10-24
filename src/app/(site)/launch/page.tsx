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
import { AutoSubmitSelect } from "@/components/site/brand/auto-submit-select";
import { LaunchHero } from "@/components/site/brand/launch-hero";
import { LaunchSteps } from "@/components/site/brand/launch-steps";
import { LaunchStudio } from "@/components/site/brand/launch-studio";
import { LabelPreview } from "@/components/site/brand/label-preview";
import { OrderSummary } from "@/components/site/cart/order-summary";
import { CataloguePagination } from "@/components/site/catalogue/catalogue-pagination";
import { ProductVisual } from "@/components/site/catalogue/product-visual";
import { CheckoutForm } from "@/components/site/checkout/checkout-form";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonArrow, buttonClasses } from "@/components/ui/button";
import { FormAlert } from "@/components/site/auth/form-alert";
import { ComingSoon, EmptyState } from "@/components/ui/empty-state";
import { brand as copy } from "@/content/brand";
import { checkout as checkoutCopy } from "@/content/checkout";
import { checkoutOff as paused } from "@/content/maintenance";
import {
  isImageLogo,
  launchHref,
  launchStepNumber,
  nextBrandTier,
} from "@/lib/brand";
import { MAX_BRAND_PROFILES } from "@/lib/label";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { signInPath } from "@/lib/auth-routes";
import { getSession } from "@/server/auth/session";
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
 * Build Your Brand (P2.1, sign-in required): order products in your own
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
  // Signed out: the product step is a public landing (the catalogue, the
  // live preview and a sign-in prompt). Every later step, and every server
  // action, still requires sign-in.
  const session = await getSession();
  if (!session) {
    if (requested > 1) redirect(signInPath(`/launch?step=${requested}`));
    return (
      <LaunchFrame step={1}>
        <ProductStep cart={null} params={params} />
      </LaunchFrame>
    );
  }
  const { user } = session;
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
    <LaunchFrame step={step}>
        {step === 1 && <ProductStep cart={cart} params={params} />}
        {step === 2 && <CartStep cart={cart} />}
        {step === 3 && (
          <PackagingStep
            cart={cart}
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
    </LaunchFrame>
  );
}

/** The v2 page: hero, then the steps bar and the step on the cream body. */
function LaunchFrame({ step, children }: { step: number; children: ReactNode }) {
  const hero = copy.launch.hero;
  return (
    <>
      <LaunchHero
        kicker={hero.kicker}
        title={hero.title}
        line={hero.line}
        note={{
          status: hero.noteStatus,
          title: hero.noteTitle,
          line: hero.noteLine,
        }}
      />
      <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
        <div className="shell">
          <LaunchSteps
            label={copy.launch.stepsLabel}
            steps={copy.launch.steps.map((label, index) => ({
              label,
              detail: copy.launch.stepDetails[index],
            }))}
            current={step - 1}
          />
          <section aria-labelledby="launch-step-title" className="mt-6.25">
            <p className="sr-only">
              {copy.launch.stepOf(step, copy.launch.steps.length)}
            </p>
            {children}
          </section>
        </div>
      </div>
    </>
  );
}

function StepHeading({
  title,
  line,
  hidden = false,
}: {
  title: string;
  line: string;
  /** Kept for screen readers only (the steps bar already says it). */
  hidden?: boolean;
}) {
  return (
    <div className={cn(hidden && "sr-only")}>
      <h2 id="launch-step-title" className="text-h3 text-ink">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-body text-muted">{line}</p>
    </div>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────────────

/** Pack header colours, in turn: green, saffron, blue (as in v2). */
const packColours = ["bg-pack-green", "bg-pack-saffron", "bg-pack-blue"] as const;

async function ProductStep({
  cart,
  params,
}: {
  /** Null when signed out: the catalogue shows, ordering asks to sign in. */
  cart: BrandCartView | null;
  params: Record<string, string | string[] | undefined>;
}) {
  const [listing, shipping] = await Promise.all([
    listBrandProducts(brandFiltersSchema.parse(params)),
    getSetting("checkout.shipping"),
  ]);
  const { filters, products } = listing;
  const inCart = new Map(
    (cart?.lines ?? []).map((line) => [line.productId, line.quantity]),
  );
  const guest = cart === null;
  const signIn = signInPath("/launch");
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
  const control =
    "h-11 w-full min-w-0 rounded-md border border-line bg-surface text-sm text-ink transition outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15";
  const featured = products.find(
    (product) => product.makeable === null || product.makeable >= product.terms.minQty,
  );

  return (
    <>
      <StepHeading title={text.title} line={text.line} hidden />
      {guest && (
        <div className="mb-6.25 grid gap-6 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-12">
          <section
            aria-labelledby="launch-guest-title"
            className="flex flex-col items-start"
          >
            <h2 id="launch-guest-title" className="text-h3 text-ink">
              {copy.launch.guest.title}
            </h2>
            <p className="mt-3 mb-5 max-w-xl text-body text-muted lg:mb-0">
              {copy.launch.guest.line}
            </p>
            <ol className="my-6 flex flex-col gap-4.25 max-lg:hidden">
              {copy.launch.steps.map((label, index) => (
                <li key={label} className="flex items-center gap-3.5">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-[11px] border border-line bg-surface font-heading text-xs font-extrabold text-orange-ink"
                  >
                    {index + 1}
                  </span>
                  <span className="flex flex-col">
                    <b className="text-sm font-bold text-ink">{label}</b>
                    <small className="mt-0.75 text-xs text-muted">
                      {copy.launch.stepDetails[index]}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
            <Link href={signIn} className={buttonClasses({ className: "max-sm:w-full" })}>
              {copy.launch.guest.signIn}
              <ButtonArrow />
            </Link>
          </section>
          {featured && (
            <LaunchStudio
              product={{
                name: featured.name,
                formName: featured.formName,
                packSize: featured.packSize,
                terms: featured.terms,
              }}
              action={
                <Link href={signIn} className={buttonClasses({ size: "sm" })}>
                  {copy.launch.guest.cardAction}
                </Link>
              }
            />
          )}
        </div>
      )}
      {cart && cart.lines.length > 0 && (
        <section
          aria-label={text.cartBar.label}
          className="mb-4.25 flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-surface p-3.5 shadow-card"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
            <ShoppingBag aria-hidden className="size-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-muted">
            <span className="block font-heading font-extrabold text-ink">
              {text.cartBar.label}
            </span>
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
        className="mb-4.25 grid grid-cols-[minmax(0,1fr)_auto] gap-2.25 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
      >
        {(["maker", "minPrice", "maxPrice", "sort"] as const).map(
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
        <span className="relative block min-w-0">
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
            className={cn(control, "pr-3 pl-10")}
          />
        </span>
        <div className="order-last col-span-2 grid grid-cols-2 gap-2.25 md:contents">
          <label className="min-w-0">
            <span className="sr-only">{filterText.form}</span>
            <AutoSubmitSelect
              name="form"
              defaultValue={filters.form ?? ""}
              className={cn(control, "cursor-pointer px-3 font-bold text-muted md:w-auto")}
            >
              <option value="">{copy.launch.allFormsOption}</option>
              {listing.forms.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
          <label className="min-w-0">
            <span className="sr-only">{filterText.area}</span>
            <AutoSubmitSelect
              name="area"
              defaultValue={filters.area ?? ""}
              className={cn(control, "cursor-pointer px-3 font-bold text-muted md:w-auto")}
            >
              <option value="">{copy.launch.allAreas}</option>
              {listing.areas.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
        </div>
        <Button
          type="submit"
          variant="dark"
          className="h-11 min-h-11 rounded-md px-4 text-sm md:order-2"
        >
          {text.search}
        </Button>
      </form>

      <div className="grid gap-4.5 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4.5 lg:sticky lg:top-40 lg:self-start">
          <nav
            aria-label={filterText.label}
            className="rounded-xl border border-line bg-surface p-4.5 shadow-card max-lg:hidden"
          >
            <SideList
              title={copy.launch.sideForm}
              allLabel={copy.launch.allFormulations}
              allHref={hrefFor({ form: undefined })}
              options={listing.forms}
              active={filters.form}
              hrefFor={(form) => hrefFor({ form })}
            />
            {listing.areas.length > 0 && (
              <SideList
                title={copy.launch.sideArea}
                allLabel={copy.launch.allAreas}
                allHref={hrefFor({ area: undefined })}
                options={listing.areas}
                active={filters.area}
                hrefFor={(area) => hrefFor({ area })}
                className="mt-4.5"
              />
            )}
          </nav>
          <LaunchFilterPanel
            makers={listing.makers}
            filters={filters}
            priceRange={listing.priceRange}
            activeCount={chips.length}
          />
        </aside>

        <section aria-labelledby="launch-results" className="min-w-0">
          <div className="mb-3.25 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id="launch-results" className="font-heading text-sm font-extrabold text-ink">
                {copy.launch.catalogueTitle}
              </h3>
              <p aria-live="polite" className="text-xs text-muted">
                {resultsLabel}
              </p>
            </div>
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
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-brand/30 bg-surface px-3.5 text-sm font-bold text-brand transition hover:bg-brand-soft"
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
                className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 md:grid-cols-3"
              >
                {products.map((product, index) => (
                  <ProductChoice
                    key={product.id}
                    product={product}
                    inCart={inCart.get(product.id) ?? null}
                    pack={packColours[index % packColours.length]}
                    signInHref={guest ? signIn : null}
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

/** One group of the v2 side filter list: plain links, the active one bold green. */
function SideList({
  title,
  allLabel,
  allHref,
  options,
  active,
  hrefFor,
  className,
}: {
  title: string;
  allLabel: string;
  allHref: string;
  options: { key: string; name: string }[];
  active?: string;
  hrefFor: (key: string) => string;
  className?: string;
}) {
  const link = (href: string, label: string, current: boolean) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "block py-1.25 text-[13px] transition hover:text-brand",
        current ? "font-extrabold text-brand" : "text-muted",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className={className}>
      <p className="mb-2.25 font-heading text-[13px] font-extrabold text-ink">{title}</p>
      <ul className="flex flex-col gap-0.5">
        <li>{link(allHref, allLabel, !active)}</li>
        {options.map((option) => (
          <li key={option.key}>
            {link(hrefFor(option.key), option.name, option.key === active)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One product in the brand catalogue, as the v2 catalogue card: a coloured
 * pack header with "Your brand", the name and pack size, then the branded
 * price, minimum order, step and best bulk price, and "Add to launch cart"
 * (or a sign-in link when signed out).
 */
function ProductChoice({
  product,
  inCart,
  pack,
  signInHref,
}: {
  product: BrandProduct;
  inCart: number | null;
  pack: (typeof packColours)[number];
  signInHref: string | null;
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
        "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface shadow-card",
        chosen ? "border-brand" : "border-line",
      )}
    >
      <div
        className={cn(
          "relative flex h-35.5 flex-col items-center justify-center p-3.75 text-center text-white",
          pack,
        )}
      >
        <div aria-hidden className="flex flex-col items-center">
          <span className="font-heading text-[10px] font-bold tracking-[0.09em] uppercase">
            {copy.launch.yourBrand(product.formName)}
          </span>
          <b className="mt-3.5 mb-2 line-clamp-2 font-heading text-[19px] leading-[1.1] font-extrabold">
            {product.name}
          </b>
          <small className="text-[11px] opacity-80">{product.packSize}</small>
        </div>
        {chosen && (
          <Badge variant="orange" className="absolute top-2.5 left-2.5">
            {text.inCart}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <p className="truncate text-[11px] font-extrabold tracking-wide text-orange-ink uppercase">
          {product.makerName ?? product.formName}
        </p>
        <h4 className="mt-1.25 mb-2.25 font-heading text-base leading-snug font-extrabold text-ink">
          {product.name}
        </h4>
        <div className="flex justify-between gap-3 border-t border-line pt-2.25">
          <p className="flex min-w-0 flex-col">
            <small className="text-[11px] text-muted">{text.priceNote}</small>
            <b className="mt-0.5 text-[15px] font-extrabold text-ink">
              {text.price(formatPaise(terms.unitPricePaise))}
            </b>
          </p>
          <p className="flex min-w-0 flex-col text-right">
            <small className="text-[11px] text-muted">
              {terms.minQty > 1 ? text.steps(terms.minQty) : " "}
            </small>
            <b className="mt-0.5 text-[13px] font-extrabold text-ink">
              {text.minimum(terms.minQty, terms.unitLabel)}
            </b>
          </p>
        </div>
        {best && (
          <p className="mt-2.25 rounded-sm bg-brand-soft px-2.5 py-1.5 text-xs font-bold text-brand">
            {text.bulkFrom(
              best.minQty,
              terms.unitLabel,
              formatPaise(best.unitPricePaise),
            )}
          </p>
        )}
        {product.makeable !== null && (
          <p
            className={cn(
              "mt-2 text-xs font-bold",
              soldOut ? "text-danger" : "text-success",
            )}
          >
            {soldOut
              ? text.outOfStock
              : text.available(product.makeable, terms.unitLabel)}
          </p>
        )}
        <div className="mt-auto pt-2.75">
          {signInHref ? (
            <Link
              href={signInHref}
              aria-label={copy.launch.guest.cardActionLabel(product.name)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-brand px-3 text-xs font-extrabold text-white transition hover:bg-brand-mid"
            >
              {copy.launch.guest.cardAction}
              <ButtonArrow className="size-3.5" />
            </Link>
          ) : soldOut && inCart === null ? (
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
            className="inline-flex min-h-11 items-center self-start text-sm font-bold text-brand hover:underline"
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
              {bulk && <Badge variant="brand">{text.bulkApplied}</Badge>}
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
                          ? "border-brand bg-brand-soft font-bold text-brand"
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
  cart,
  userId,
  draft,
  profiles,
  profile,
}: {
  cart: BrandCartView;
  userId: string;
  draft: BrandDraftView | null;
  profiles: BrandProfileView[];
  profile: BrandProfileView | null;
}) {
  const lines = profile?.logo ? await readLabelLines(userId, profile) : [];
  const logo = profileLogoProps(profile);
  const firstProduct = cart.lines.find((line) => line.product)?.product ?? null;
  return (
    <>
      <StepHeading title={copy.packaging.title} line={copy.packaging.line} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-5.5">
      <div className="flex min-w-0 flex-col gap-8">
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
      <LabelPreview
        brandName={profile?.brandName ?? null}
        tagline={profile?.tagline ?? null}
        marketedBy={profile?.marketedByName ?? null}
        logoSrc={
          logo && isImageLogo(logo.contentType) ? logo.src : null
        }
        product={firstProduct ? { name: firstProduct.name, packSize: firstProduct.packSize } : null}
        productCount={cart.lines.length}
        className="lg:sticky lg:top-40"
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
          className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline"
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
  const [shipping, addresses, phone, checkoutSwitch] =
    await Promise.all([
      getSetting("checkout.shipping"),
      listAddresses(userId),
      getSetting("contact.phone"),
      getSetting("checkout.enabled"),
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
        {/* "Label for each product" review is switched off for now.
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
        */}
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
