"use client";

import {
  Suspense,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalClose, ModalContent } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { shell } from "@/content/shell";
import { signIn as signInCopy } from "@/content/sign-in";
import { useAuthSession } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/auth-routes";
import { telHref } from "@/lib/phone";
import type { SignUpUserType } from "@/server/content/user-types";
import type { SignedIn } from "./auth/phone-flow";
import { SignInModal } from "./auth/sign-in-modal";
import { TrackOrderForm } from "./orders/track-order-form";
import { ReportProblemModal } from "./report-problem";

export type SiteModal = "signIn" | "trackOrder" | "reportProblem";

type OpenModal = (modal: SiteModal, trigger?: HTMLElement | null) => void;

type SiteModalsApi = {
  open: OpenModal;
  /** Asks the element marked `data-focus-key={key}` to take focus next. */
  requestFocus: (key: string) => void;
  /** True (once) if focus was requested for `key`. */
  claimFocus: (key: string) => boolean;
};

const SiteModalsContext = createContext<SiteModalsApi | null>(null);

/**
 * Holds the site-wide modals (sign-in, track order, report a problem) once, so any button in
 * the header, footer, dock or page can open them with `useSiteModal()`.
 * Focus returns to whichever button opened the modal.
 *
 * Sign-in also opens by itself on `/?auth=sign-in&next=/path` (where
 * protected pages send signed-out visitors), and goes to `next` afterwards.
 */
export function SiteModalsProvider({
  phone,
  userTypes,
  devShowOtp,
  children,
}: {
  /** Support number shown in the track-order modal. */
  phone: string;
  /** Active user types for "I am a", Customer first. */
  userTypes: readonly SignUpUserType[];
  /** Show the latest OTP in the code step (dev only, see isDevOtpVisible). */
  devShowOtp: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const session = useAuthSession();
  const [open, setOpen] = useState<SiteModal | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusRequest = useRef<string | null>(null);
  /** Where to go after signing in, from `?next=`. */
  const nextPath = useRef<string | null>(null);
  const openedFromUrl = useRef(false);

  const openModal = useCallback<OpenModal>((modal, trigger) => {
    // Safari doesn't focus a clicked button, so prefer the element passed in.
    returnFocus.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setOpen(modal);
  }, []);

  // `?auth=sign-in` opens sign-in, on first load and after in-site
  // navigation (the layout stays mounted, so this can't be a mount effect).
  const requestSignIn = useCallback((next: string | null) => {
    nextPath.current = next;
    openedFromUrl.current = true;
    setOpen("signIn");
  }, []);

  /** Drops ?auth and ?next once the sign-in they asked for is done. */
  const clearUrlRequest = useCallback(() => {
    if (!openedFromUrl.current) return;
    openedFromUrl.current = false;
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    url.searchParams.delete("next");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const goNext = useCallback(() => {
    const next = nextPath.current;
    nextPath.current = null;
    clearUrlRequest();
    if (next) router.push(next);
  }, [clearUrlRequest, router]);

  // Already signed in when the URL asked for sign-in: just go on.
  const signedIn = Boolean(session.data);
  useEffect(() => {
    if (signedIn && open === "signIn" && openedFromUrl.current) {
      setOpen(null);
      goNext();
    }
  }, [signedIn, open, goNext]);

  const api = useMemo<SiteModalsApi>(
    () => ({
      open: openModal,
      requestFocus: (key) => {
        focusRequest.current = key;
      },
      claimFocus: (key) => {
        if (focusRequest.current !== key) return false;
        focusRequest.current = null;
        return true;
      },
    }),
    [openModal],
  );

  // Radix only returns focus to its own Trigger; these modals open from many
  // places, so return it by hand.
  const restoreFocus = useCallback((event: Event) => {
    event.preventDefault();
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  const onOpenChange = (next: boolean) => {
    if (next) return;
    setOpen(null);
    clearUrlRequest();
    nextPath.current = null;
  };

  const onSignedIn = ({ name, isNew }: SignedIn) => {
    toast({
      tone: "success",
      title: signInCopy.welcome(name),
      description: isNew ? signInCopy.registered : signInCopy.welcomeBack,
    });
    // The button that opened sign-in is swapped for the signed-in one; ask
    // that one to take focus when it appears.
    const key = returnFocus.current?.dataset.focusKey;
    if (key) api.requestFocus(key);
    setOpen(null);
    // Staying on this page: re-render it on the server so guest-only parts
    // (Dr. Talk's "Sign in to read", course and quiz buttons) show the
    // signed-in view without a manual reload.
    if (!nextPath.current) router.refresh();
    goNext();
  };

  return (
    <SiteModalsContext value={api}>
      {children}
      {/* Suspense keeps useSearchParams from stopping the pages being static. */}
      <Suspense fallback={null}>
        <SignInRequestWatcher onRequest={requestSignIn} />
      </Suspense>
      <Modal open={open === "signIn"} onOpenChange={onOpenChange}>
        <SignInModal
          userTypes={userTypes}
          devShowOtp={devShowOtp}
          onSignedIn={onSignedIn}
          onCloseAutoFocus={restoreFocus}
        />
      </Modal>
      <Modal open={open === "trackOrder"} onOpenChange={onOpenChange}>
        <TrackOrderModal phone={phone} onCloseAutoFocus={restoreFocus} />
      </Modal>
      <Modal open={open === "reportProblem"} onOpenChange={onOpenChange}>
        {/* Mounted only while open, so each opening starts a fresh form. */}
        {open === "reportProblem" && <ReportProblemModal onCloseAutoFocus={restoreFocus} />}
      </Modal>
    </SiteModalsContext>
  );
}

/** Calls `onRequest(next)` whenever the address gains `?auth=sign-in`. */
function SignInRequestWatcher({
  onRequest,
}: {
  onRequest: (next: string | null) => void;
}) {
  const params = useSearchParams();
  const auth = params.get("auth");
  const next = params.get("next");
  useEffect(() => {
    if (auth === "sign-in") onRequest(safeNextPath(next));
  }, [auth, next, onRequest]);
  return null;
}

function useSiteModalsApi(): SiteModalsApi {
  const api = use(SiteModalsContext);
  if (!api)
    throw new Error("useSiteModal must be used inside <SiteModalsProvider>");
  return api;
}

/** Returns `open(modal, triggerElement)`. */
export function useSiteModal(): OpenModal {
  return useSiteModalsApi().open;
}

/** Ask the element with `data-focus-key={key}` to take focus when it appears. */
export function useRequestFocus(): (key: string) => void {
  return useSiteModalsApi().requestFocus;
}

/**
 * Focuses `ref` when focus was requested for `key`: after signing in or out,
 * the button that was used is replaced by its signed-in (or signed-out)
 * version, and this moves focus onto the new one. Re-checks whenever
 * `state` changes.
 */
export function useClaimFocus(
  key: string,
  ref: RefObject<HTMLElement | null>,
  state: unknown,
) {
  const { claimFocus } = useSiteModalsApi();
  useEffect(() => {
    if (ref.current && claimFocus(key)) ref.current.focus();
  }, [key, ref, state, claimFocus]);
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

/** Order number plus phone or email, then the order's live timeline. */
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
      <TrackOrderForm headingLevel="h3" />
      <p className="mt-5 text-sm text-muted">
        {copy.myOrdersLead}{" "}
        <ModalClose asChild>
          <Link
            href="/orders"
            className="font-bold text-brand underline-offset-4 hover:underline"
          >
            {copy.myOrders}
          </Link>
        </ModalClose>
      </p>
      <p className="mt-1 text-sm text-muted">
        {copy.helpLead}{" "}
        <a
          href={telHref(phone)}
          className="inline-flex min-h-11 items-center gap-1.5 font-bold text-brand underline-offset-4 hover:underline"
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
