"use client";

import type { ComponentProps, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";
import { Eyebrow } from "./badge";
import { IconButton } from "./icon-button";

/** Dialog root (Radix): controls open state. */
export const Modal = Dialog.Root;
/** Wrap a Button with `asChild` to open the modal. */
export const ModalTrigger = Dialog.Trigger;
/** Wrap a Button with `asChild` to close the modal. */
export const ModalClose = Dialog.Close;

export type ModalContentProps = Omit<
  ComponentProps<typeof Dialog.Content>,
  "title"
> & {
  title: ReactNode;
  description?: ReactNode;
  /** Brand-green tile above the title, as on the mockup's sign-in modal. */
  icon?: ReactNode;
  /** Small uppercase label above the title ("MY PROFILE"). */
  eyebrow?: ReactNode;
  /** A logo above everything (the v2 sign-in modal shows the client's logo). */
  logo?: ReactNode;
  /** Centre the header (logo, eyebrow, title, description), as in v2 sign-in. */
  centered?: boolean;
};

/**
 * The modal card: centred (up to 530 px) from 560 px up, a bottom sheet on
 * phones. Focus is trapped; Esc and a backdrop click close it.
 */
export function ModalContent({
  title,
  description,
  icon,
  eyebrow,
  logo,
  centered = false,
  className,
  children,
  ...props
}: ModalContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-300 bg-backdrop backdrop-blur-[8px] data-[state=open]:animate-fade-in" />
      <Dialog.Content
        // Without a description Radix wants aria-describedby explicitly unset.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed z-300 overflow-y-auto bg-surface shadow-modal focus:outline-none data-[state=open]:animate-rise-in",
          // Phones: a bottom sheet floating 10 px in (v2 `.modal-card`).
          "inset-x-2.5 bottom-2.5 max-h-[92dvh] rounded-[24px_24px_15px_15px] px-5 pt-6.75 pb-[max(27px,env(safe-area-inset-bottom))]",
          // 560 px and up: centred card.
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-40px)] sm:w-[min(520px,calc(100%-40px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[25px] sm:p-8.75",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="mx-auto -mt-2.5 mb-4 block h-1 w-10 rounded-full bg-line sm:hidden"
        />
        <Dialog.Close asChild>
          <IconButton
            label={ui.close}
            variant="soft"
            shape="round"
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3.5"
          >
            <X aria-hidden />
          </IconButton>
        </Dialog.Close>
        {logo && <div className="mb-3.75 flex justify-center">{logo}</div>}
        {icon && (
          <span
            aria-hidden
            className={cn(
              "mb-5 grid size-12 place-items-center rounded-button bg-avatar text-white [&_svg]:size-6",
              centered && "mx-auto",
            )}
          >
            {icon}
          </span>
        )}
        {eyebrow &&
          (centered ? (
            <p className="mb-2.25 text-center font-heading text-[11px] font-extrabold tracking-[0.12em] text-orange-ink uppercase">
              {eyebrow}
            </p>
          ) : (
            <Eyebrow className="mb-2 pr-12">{eyebrow}</Eyebrow>
          ))}
        <Dialog.Title
          className={cn(
            "text-[27px] leading-[1.1] font-extrabold tracking-[-0.04em] text-ink sm:text-[31px]",
            centered ? "px-6 text-center" : "pr-12",
          )}
        >
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description
            className={cn(
              "mt-2.5 text-sm text-muted",
              centered && "mx-auto max-w-97.5 text-center",
            )}
          >
            {description}
          </Dialog.Description>
        )}
        <div className="mt-6">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
