"use client";

import {
  createContext,
  use,
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/ui/empty-state";
import { Modal, ModalClose, ModalContent } from "@/components/ui/modal";
import { Stepper } from "@/components/ui/stepper";
import { shell } from "@/content/shell";
import { telHref } from "@/lib/phone";

export type SiteModal = "signIn" | "trackOrder";

type OpenModal = (modal: SiteModal, trigger?: HTMLElement | null) => void;

const SiteModalsContext = createContext<OpenModal | null>(null);

/**
 * Holds the site-wide modals (sign-in, track order) once, so any button in
 * the header, footer, dock or page can open them with `useSiteModal()`.
 * Focus returns to whichever button opened the modal.
 */
export function SiteModalsProvider({
  phone,
  children,
}: {
  /** Support number shown in the track-order modal. */
  phone: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<SiteModal | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openModal = useCallback<OpenModal>((modal, trigger) => {
    // Safari doesn't focus a clicked button, so prefer the element passed in.
    returnFocus.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setOpen(modal);
  }, []);

  // Radix only returns focus to its own Trigger; these modals open from many
  // places, so return it by hand.
  const restoreFocus = useCallback((event: Event) => {
    event.preventDefault();
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  const onOpenChange = (next: boolean) => {
    if (!next) setOpen(null);
  };

  return (
    <SiteModalsContext value={openModal}>
      {children}
      <Modal open={open === "signIn"} onOpenChange={onOpenChange}>
        <SignInModal onCloseAutoFocus={restoreFocus} />
      </Modal>
      <Modal open={open === "trackOrder"} onOpenChange={onOpenChange}>
        <TrackOrderModal phone={phone} onCloseAutoFocus={restoreFocus} />
      </Modal>
    </SiteModalsContext>
  );
}

/** Returns `open(modal, triggerElement)`. */
export function useSiteModal(): OpenModal {
  const open = use(SiteModalsContext);
  if (!open)
    throw new Error("useSiteModal must be used inside <SiteModalsProvider>");
  return open;
}

export type SiteModalButtonProps = Omit<
  ComponentProps<"button">,
  "onClick" | "type"
> & { modal: SiteModal };

/** A plain button that opens one of the site modals. */
export function SiteModalButton({ modal, ...props }: SiteModalButtonProps) {
  const open = useSiteModal();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => open(modal, event.currentTarget)}
      {...props}
    />
  );
}

type ModalBodyProps = { onCloseAutoFocus: (event: Event) => void };

/** Placeholder for the sign-in / register flow, which arrives in A6. */
function SignInModal({ onCloseAutoFocus }: ModalBodyProps) {
  const copy = shell.signIn;
  return (
    <ModalContent
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      icon={
        <span className="text-base tracking-[-1px]">{shell.brand.mark}</span>
      }
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <ComingSoon
        as="h3"
        title={copy.soonTitle}
        description={copy.soonBody}
        className="py-7"
      />
      <ModalClose asChild>
        <Button variant="secondary" className="mt-5 w-full">
          {copy.close}
        </Button>
      </ModalClose>
    </ModalContent>
  );
}

/** Shows how order steps will look, with an honest "coming soon" note. */
function TrackOrderModal({
  phone,
  onCloseAutoFocus,
}: ModalBodyProps & { phone: string }) {
  const copy = shell.trackOrder;
  return (
    <ModalContent
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="rounded-lg border border-line bg-surface-alt px-3 pt-3.5 pb-4">
        <p aria-hidden className="text-label text-muted uppercase">
          {copy.exampleTitle}
        </p>
        <Stepper
          steps={copy.steps}
          current={copy.exampleCurrent}
          label={copy.exampleLabel}
          className="mt-3"
        />
      </div>
      <p
        role="note"
        className="mt-4 flex gap-3 rounded-lg bg-orange-soft p-4 text-sm text-ink"
      >
        <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-orange-ink" />
        {copy.soonNote}
      </p>
      <p className="mt-4 text-sm text-muted">
        {copy.helpLead}{" "}
        <a
          href={telHref(phone)}
          className="inline-flex min-h-11 items-center gap-1.5 font-bold text-teal underline-offset-4 hover:underline"
        >
          <Phone aria-hidden className="size-4" />
          {copy.call(phone)}
        </a>
      </p>
      <ModalClose asChild>
        <Button variant="secondary" className="mt-3 w-full">
          {copy.close}
        </Button>
      </ModalClose>
    </ModalContent>
  );
}
