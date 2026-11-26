import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ArrowRight,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Truck,
  Video,
  X,
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel } from "@/components/ui/carousel";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { CoinPill } from "@/components/ui/coin-pill";
import { ComingSoon, EmptyState } from "@/components/ui/empty-state";
import { HScroller } from "@/components/ui/hscroller";
import { IconButton } from "@/components/ui/icon-button";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalTrigger,
} from "@/components/ui/modal";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Skeleton,
  SkeletonCard,
  SkeletonGroup,
  SkeletonText,
} from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { designPage as copy } from "@/content/design";
import { isDesignPageEnabled } from "@/lib/flags";
import { ToastDemo } from "./toast-demo";

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

// Swatches list Tailwind classes literally so the build picks them up.
const colours = [
  { name: "brand", className: "bg-brand" },
  { name: "brand-mid", className: "bg-brand-mid" },
  { name: "brand-dark", className: "bg-brand-dark" },
  { name: "brand-soft", className: "bg-brand-soft" },
  { name: "brand-light", className: "bg-brand-light" },
  { name: "orange", className: "bg-orange" },
  { name: "orange-strong", className: "bg-orange-strong" },
  { name: "orange-dark", className: "bg-orange-dark" },
  { name: "orange-ink", className: "bg-orange-ink" },
  { name: "orange-title", className: "bg-orange-title" },
  { name: "orange-soft", className: "bg-orange-soft" },
  { name: "orange-light", className: "bg-orange-light" },
  { name: "gold", className: "bg-gold" },
  { name: "gold-soft", className: "bg-gold-soft" },
  { name: "gold-ink", className: "bg-gold-ink" },
  { name: "gold-light", className: "bg-gold-light" },
  { name: "success", className: "bg-success" },
  { name: "success-soft", className: "bg-success-soft" },
  { name: "blue", className: "bg-blue" },
  { name: "blue-soft", className: "bg-blue-soft" },
  { name: "danger", className: "bg-danger" },
  { name: "danger-soft", className: "bg-danger-soft" },
  { name: "ink", className: "bg-ink" },
  { name: "muted", className: "bg-muted" },
  { name: "line", className: "bg-line" },
  { name: "line-strong", className: "bg-line-strong" },
  { name: "surface", className: "bg-surface" },
  { name: "surface-alt", className: "bg-surface-alt" },
  { name: "paper", className: "bg-paper" },
  { name: "cream", className: "bg-cream" },
  { name: "forest-ink", className: "bg-forest-ink" },
  { name: "night", className: "bg-night" },
  { name: "night-ink", className: "bg-night-ink" },
] as const;

const radii = [
  { name: "sm · 8", className: "rounded-sm" },
  { name: "md · 12", className: "rounded-md" },
  { name: "button · 13", className: "rounded-button" },
  { name: "lg · 18", className: "rounded-lg" },
  { name: "xl · 24", className: "rounded-xl" },
  { name: "modal · 24", className: "rounded-modal" },
  { name: "2xl · 28", className: "rounded-2xl" },
  { name: "3xl · 30", className: "rounded-3xl" },
  { name: "full", className: "rounded-full" },
] as const;

const shadows = [
  { name: "card", className: "shadow-card" },
  { name: "raised", className: "shadow-raised" },
  { name: "modal", className: "shadow-modal" },
  { name: "cta", className: "shadow-cta" },
  { name: "gold", className: "shadow-gold" },
  { name: "forest", className: "shadow-forest" },
  { name: "dock", className: "shadow-dock" },
] as const;

const gradients = [
  { name: "bg-hero", className: "bg-hero" },
  { name: "bg-page-hero", className: "bg-page-hero" },
  { name: "bg-forest", className: "bg-forest" },
  { name: "bg-brand-wash", className: "bg-brand-wash" },
  { name: "bg-quiz", className: "bg-quiz" },
  { name: "bg-coins-band", className: "bg-coins-band" },
  { name: "bg-coin", className: "bg-coin" },
  { name: "bg-pack-green", className: "bg-pack-green" },
  { name: "bg-pack-saffron", className: "bg-pack-saffron" },
  { name: "bg-pack-blue", className: "bg-pack-blue" },
  { name: "bg-pack-gold", className: "bg-pack-gold" },
  { name: "bg-avatar", className: "bg-avatar" },
  { name: "bg-cta", className: "bg-cta" },
  { name: "bg-announcement", className: "bg-announcement" },
  { name: "bg-brand-mark", className: "bg-brand-mark" },
] as const;

const slideBackgrounds = [
  "bg-hero text-white",
  "bg-quiz text-ink",
  "bg-pack-saffron text-white",
] as const;

const contents = Object.entries(copy.groups) as [
  keyof typeof copy.groups,
  string,
][];

function Group({
  id,
  title,
  children,
}: {
  id: keyof typeof copy.groups;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-6 border-t border-line pt-10"
    >
      <h2 id={`${id}-title`} className="text-h2">
        {title}
      </h2>
      <div className="mt-8 flex flex-col gap-12">{children}</div>
    </section>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 text-h3">{title}</h3>
      {children}
    </div>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="min-w-0">
      <div className={`h-16 rounded-md border border-line ${className}`} />
      <p className="mt-1.5 truncate text-small text-muted">{name}</p>
    </div>
  );
}

export default async function DesignPage() {
  // Read the flag per request, not at build time.
  await connection();
  if (!isDesignPageEnabled()) notFound();

  const s = copy.sections;

  return (
    <main id="main" className="shell flex flex-col gap-14 py-10 sm:py-14">
      <header>
        <Eyebrow dot>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-3 text-display">{copy.title}</h1>
        <p className="mt-4 max-w-2xl text-body-lg text-muted">{copy.intro}</p>
        <nav aria-label={copy.contentsLabel} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {contents.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-11 items-center rounded-sm border border-line px-3.5 text-sm font-semibold text-brand hover:bg-brand-soft"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Group id="tokens" title={copy.groups.tokens}>
        <Demo title={s.colour}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {colours.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Demo>
        <Demo title={s.typography}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface p-5">
                <p className="text-label text-orange-ink uppercase">
                  {copy.type.headingFontLabel}
                </p>
                <p className="mt-2 font-heading text-h3">
                  {copy.type.headingFont}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-5">
                <p className="text-label text-orange-ink uppercase">
                  {copy.type.bodyFontLabel}
                </p>
                <p className="mt-2 text-body-lg">{copy.type.bodyFont}</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-hero p-6 text-white sm:p-9">
              <span aria-hidden className="absolute inset-0 bg-dots" />
              <div className="relative">
                <Eyebrow dot tone="light">
                  {copy.type.heroEyebrow}
                </Eyebrow>
                <p className="mt-3 font-heading text-display">
                  {copy.type.display}{" "}
                  <em className="block text-gold-light not-italic">
                    {copy.type.displayEmphasis}
                  </em>
                </p>
                <p className="mt-4 max-w-xl text-body-lg text-forest-ink">
                  {copy.type.bodyLg}
                </p>
              </div>
            </div>
            <p className="font-heading text-h1">{copy.type.h1}</p>
            <p className="font-heading text-h2">
              {copy.type.h2}{" "}
              <em className="block text-orange-title not-italic">
                {copy.type.h2Emphasis}
              </em>
            </p>
            <p className="font-heading text-h3">{copy.type.h3}</p>
            <p className="font-heading text-h4">{copy.type.h4}</p>
            <p className="text-body-lg">{copy.type.bodyLg}</p>
            <p className="text-body">{copy.type.body}</p>
            <p className="text-small font-medium text-muted">
              {copy.type.small}
            </p>
            <p className="font-heading text-label text-brand-mid uppercase">
              {copy.type.label}
            </p>
            <p lang="hi" className="text-body-lg">
              {copy.type.hindiSans}
            </p>
            <p lang="hi" className="font-heading text-h3">
              {copy.type.hindiSans}
            </p>
            <p lang="hi" className="font-serif-hindi text-h3">
              {copy.type.hindiSerif}
            </p>
          </div>
        </Demo>
        <Demo title={s.radius}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {radii.map((r) => (
              <div key={r.name}>
                <div
                  className={`h-16 border-2 border-brand bg-brand-soft ${r.className}`}
                />
                <p className="mt-1.5 text-small text-muted">{r.name}</p>
              </div>
            ))}
          </div>
        </Demo>
        <Demo title={s.shadow}>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {shadows.map((sh) => (
              <div key={sh.name}>
                <div
                  className={`h-20 rounded-xl border border-line bg-surface ${sh.className}`}
                />
                <p className="mt-2 text-small text-muted">{sh.name}</p>
              </div>
            ))}
          </div>
        </Demo>
        <Demo title={s.gradients}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {gradients.map((g) => (
              <Swatch key={g.name} name={g.name} className={g.className} />
            ))}
            <div className="min-w-0">
              <div className="relative h-16 overflow-hidden rounded-md bg-page-hero">
                <span aria-hidden className="absolute inset-0 bg-dots" />
              </div>
              <p className="mt-1.5 truncate text-small text-muted">bg-dots</p>
            </div>
          </div>
        </Demo>
        <Demo title={s.motion}>
          <p className="max-w-2xl text-muted">{copy.motion.body}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {copy.motion.cards.map((card) => (
              <div
                key={card}
                className="reveal rounded-xl border border-line bg-surface p-5 shadow-card"
              >
                <p className="font-heading text-h4">{card}</p>
              </div>
            ))}
          </div>
        </Demo>
      </Group>

      <Group id="actions" title={copy.groups.actions}>
        <Demo title={s.button}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button arrow>{copy.buttons.primary}</Button>
              <Button variant="secondary">{copy.buttons.secondary}</Button>
              <Button variant="link" arrow>
                {copy.buttons.link}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">{copy.buttons.small}</Button>
              <Button size="sm" variant="secondary">
                {copy.buttons.small}
              </Button>
              <Button loading>{copy.buttons.loading}</Button>
              <Button disabled variant="secondary">
                {copy.buttons.disabled}
              </Button>
            </div>
            <div className="rounded-xl p-5 bg-forest">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="light" arrow>
                  {copy.buttons.light}
                </Button>
                <Button variant="ghost-dark">{copy.buttons.ghostDark}</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="dark">{copy.buttons.dark}</Button>
              <Button size="lg" arrow>
                {copy.buttons.large}
              </Button>
            </div>
            <div>
              <p className="mb-3 text-small text-muted">
                {copy.buttons.groupNote}
              </p>
              <ButtonGroup>
                <Button arrow>{copy.buttons.primary}</Button>
                <Button variant="secondary">{copy.buttons.secondary}</Button>
              </ButtonGroup>
            </div>
          </div>
        </Demo>
        <Demo title={s.iconButton}>
          <div className="flex flex-wrap items-center gap-3">
            <IconButton label={copy.iconButtons.search}>
              <Search aria-hidden />
            </IconButton>
            <IconButton label={copy.iconButtons.bag} variant="outline">
              <ShoppingBag aria-hidden />
            </IconButton>
            <IconButton
              label={copy.iconButtons.close}
              variant="soft"
              shape="round"
            >
              <X aria-hidden />
            </IconButton>
            <IconButton
              label={copy.iconButtons.next}
              variant="outline"
              shape="round"
            >
              <ArrowRight aria-hidden />
            </IconButton>
          </div>
        </Demo>
      </Group>

      <Group id="forms" title={copy.groups.forms}>
        <Demo title={s.input}>
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label={copy.forms.nameLabel}
              placeholder={copy.forms.namePlaceholder}
              autoComplete="name"
            />
            <Input
              label={copy.forms.emailLabel}
              type="email"
              help={copy.forms.emailHelp}
              optional
              autoComplete="email"
            />
            <Input
              label={copy.forms.emailLabel}
              type="email"
              defaultValue={copy.forms.emailInvalidValue}
              error={copy.forms.emailError}
            />
            <Input
              label={copy.forms.disabledLabel}
              defaultValue={copy.forms.disabledValue}
              disabled
            />
          </div>
        </Demo>
        <Demo title={s.phoneInput}>
          <div className="grid gap-5 md:grid-cols-2">
            <PhoneInput
              label={copy.forms.phoneLabel}
              help={copy.forms.phoneHelp}
            />
            <PhoneInput
              label={copy.forms.phoneErrorLabel}
              defaultValue="92203"
              error={copy.forms.phoneError}
            />
          </div>
        </Demo>
        <Demo title={s.otpInput}>
          <div className="grid gap-5 md:grid-cols-2">
            <OtpInput label={copy.forms.otpLabel} help={copy.forms.otpHelp} />
            <OtpInput
              label={copy.forms.otpErrorLabel}
              defaultValue="1234"
              error={copy.forms.otpError}
            />
          </div>
        </Demo>
        <Demo title={s.passwordInput}>
          <div className="grid gap-5 md:grid-cols-2">
            <PasswordInput
              label={copy.forms.passwordLabel}
              autoComplete="current-password"
            />
            <PasswordInput
              label={copy.forms.newPasswordLabel}
              autoComplete="new-password"
              showStrength
            />
          </div>
        </Demo>
        <Demo title={s.checkbox}>
          <div className="flex flex-col gap-1">
            <Checkbox>{copy.forms.checkboxTerms}</Checkbox>
            <Checkbox defaultChecked>{copy.forms.checkboxMarketing}</Checkbox>
            <Checkbox error={copy.forms.checkboxError}>
              {copy.forms.checkboxTerms}
            </Checkbox>
          </div>
        </Demo>
        <Demo title={s.choiceChips}>
          <div className="flex flex-col gap-6">
            <ChoiceChips
              label={copy.chips.userTypeLabel}
              options={copy.chips.userTypes}
              defaultValue="customer"
              name="userType"
            />
            <ChoiceChips
              label={copy.chips.filterLabel}
              options={copy.chips.filters}
              defaultValue="all"
              layout="scroll"
            />
          </div>
        </Demo>
      </Group>

      <Group id="display" title={copy.groups.display}>
        <Demo title={s.card}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h4 className="text-h3">{copy.cards.staticTitle}</h4>
              <p className="mt-2 text-muted">{copy.cards.staticBody}</p>
            </Card>
            <Card interactive>
              <h4 className="text-h3">{copy.cards.interactiveTitle}</h4>
              <p className="mt-2 text-muted">{copy.cards.interactiveBody}</p>
            </Card>
            <Card tone="gold">
              <h4 className="text-h3">{copy.cards.goldTitle}</h4>
              <p className="mt-2">{copy.cards.goldBody}</p>
            </Card>
            <Card tone="forest">
              <h4 className="text-h3">{copy.cards.forestTitle}</h4>
              <p className="mt-2 text-forest-ink">{copy.cards.forestBody}</p>
            </Card>
          </div>
        </Demo>
        <Demo title={s.badge}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">{copy.badges.brand}</Badge>
              <Badge variant="orange">{copy.badges.orange}</Badge>
              <Badge variant="blue">{copy.badges.blue}</Badge>
              <Badge variant="gold">{copy.badges.gold}</Badge>
              <Badge variant="live">{copy.badges.live}</Badge>
              <Badge variant="soon">{copy.badges.soon}</Badge>
              <Badge variant="success">{copy.badges.success}</Badge>
              <Badge variant="dark">{copy.badges.dark}</Badge>
            </div>
            <Eyebrow>{copy.badges.eyebrow}</Eyebrow>
            <Eyebrow dot>{copy.badges.eyebrowBar}</Eyebrow>
            <div className="rounded-xl p-5 bg-forest">
              <Eyebrow tone="light">{copy.badges.eyebrow}</Eyebrow>
            </div>
          </div>
        </Demo>
        <Demo title={s.iconTile}>
          <div className="flex flex-wrap gap-5">
            <IconTile tone="orange" label={copy.iconTiles.orange}>
              <Plus />
            </IconTile>
            <IconTile tone="brand" label={copy.iconTiles.brand}>
              <Package />
            </IconTile>
            <IconTile tone="blue" label={copy.iconTiles.blue}>
              <Truck />
            </IconTile>
            <IconTile tone="gold" label={copy.iconTiles.gold}>
              <Video />
            </IconTile>
            <IconTile tone="brand" size="lg" label={copy.iconTiles.brand}>
              <Package />
            </IconTile>
          </div>
        </Demo>
        <Demo title={s.sectionHeading}>
          <div className="flex flex-col gap-6">
            <SectionHeading
              as="h4"
              eyebrow={copy.sectionHeading.eyebrow}
              title={copy.sectionHeading.title}
              emphasis={copy.sectionHeading.emphasis}
              description={copy.sectionHeading.description}
              action={{ href: "/design#display" }}
            />
            <div className="rounded-2xl p-6 bg-forest">
              <SectionHeading
                as="h4"
                tone="dark"
                eyebrow={copy.sectionHeading.darkEyebrow}
                title={copy.sectionHeading.darkTitle}
                emphasis={copy.sectionHeading.darkEmphasis}
                action={{ href: "/design#display" }}
                className="mb-0"
              />
            </div>
          </div>
        </Demo>
        <Demo title={s.avatar}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={copy.people.names[0]} size="sm" />
            <Avatar name={copy.people.names[0]} />
            <Avatar name={copy.people.names[1]} size="lg" />
            <Avatar name={copy.people.names[2]} size="lg" />
            <CoinPill balance={copy.people.coinBalance} />
            <CoinPill balance={copy.people.coinBalanceLarge} href="/design" />
            <CoinPill balance={copy.people.coinBalance} compactBelow="lg" />
            <CoinPill variant="wallet" balance={null} href="/design" walletLabel={copy.people.walletLabel} />
            <CoinPill variant="wallet" balance={copy.people.coinBalanceLarge} href="/design" />
          </div>
        </Demo>
      </Group>

      <Group id="overlays" title={copy.groups.overlays}>
        <Demo title={s.modal}>
          <Modal>
            <ModalTrigger asChild>
              <Button variant="secondary">{copy.modal.open}</Button>
            </ModalTrigger>
            <ModalContent
              eyebrow={copy.modal.eyebrow}
              title={copy.modal.title}
              description={copy.modal.description}
              icon={<Smartphone />}
            >
              <PhoneInput label={copy.forms.phoneLabel} />
              <ButtonGroup className="mt-6">
                <Button arrow>{copy.modal.submit}</Button>
                <ModalClose asChild>
                  <Button variant="secondary">{copy.modal.cancel}</Button>
                </ModalClose>
              </ButtonGroup>
            </ModalContent>
          </Modal>
        </Demo>
        <Demo title={s.toast}>
          <ToastDemo />
        </Demo>
      </Group>

      <Group id="navigation" title={copy.groups.navigation}>
        <Demo title={s.tabs}>
          <Tabs defaultValue={copy.tabs.items[0].value}>
            <TabsList aria-label={copy.tabs.label}>
              {copy.tabs.items.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {copy.tabs.items.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <p className="text-muted">{tab.body}</p>
              </TabsContent>
            ))}
          </Tabs>
          <Tabs defaultValue={copy.tabs.items[0].value} className="mt-8">
            <TabsList aria-label={copy.tabs.pillLabel} variant="pill">
              {copy.tabs.items.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {copy.tabs.items.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <p className="text-muted">{tab.body}</p>
              </TabsContent>
            ))}
          </Tabs>
        </Demo>
        <Demo title={s.stepper}>
          <Stepper
            label={copy.stepper.label}
            steps={copy.stepper.steps}
            current={3}
            className="max-w-xl"
          />
        </Demo>
        <Demo title={s.carousel}>
          <Carousel
            label={copy.carousel.label}
            slides={copy.carousel.slides.map((slide, i) => (
              <div
                key={slide.title}
                className={`flex min-h-56 flex-col justify-end rounded-2xl p-6 sm:p-8 ${slideBackgrounds[i]}`}
              >
                <p className="text-label uppercase">{slide.eyebrow}</p>
                <p className="mt-2 max-w-md text-h3">{slide.title}</p>
              </div>
            ))}
          />
        </Demo>
        <Demo title={s.hscroller}>
          <HScroller
            label={copy.hscroller.label}
            itemClassName="w-[64vw] sm:w-55"
          >
            {copy.hscroller.items.map((item) => (
              <div key={item}>
                <div className="aspect-[9/13.5] rounded-lg bg-brand-soft" />
                <p className="mt-3 text-sm font-bold">{item}</p>
              </div>
            ))}
          </HScroller>
        </Demo>
        <Demo title={s.logo}>
          <div className="flex flex-wrap items-center gap-6">
            <Logo />
            <div className="rounded-xl bg-night p-5">
              <Logo tone="light" />
            </div>
          </div>
        </Demo>
      </Group>

      <Group id="states" title={copy.groups.states}>
        <Demo title={s.skeleton}>
          <SkeletonGroup className="grid gap-4 md:grid-cols-3">
            <SkeletonCard />
            <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <SkeletonText lines={4} />
            </div>
            <SkeletonText lines={5} />
          </SkeletonGroup>
        </Demo>
        <Demo title={s.emptyState}>
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              as="h4"
              icon={<Package aria-hidden />}
              title={copy.empty.title}
              description={copy.empty.description}
              action={
                <Button variant="secondary" size="sm">
                  {copy.empty.action}
                </Button>
              }
            />
            <ComingSoon
              as="h4"
              title={copy.empty.soonTitle}
              description={copy.empty.soonDescription}
            />
          </div>
        </Demo>
      </Group>
    </main>
  );
}
