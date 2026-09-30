"use client";

import type { ComponentProps, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";
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
  /** Teal tile above the title, as on the mockup's sign-in modal. */
  icon?: ReactNode;
};

/**
 * The modal card: centred (up to 530 px) from 560 px up, a bottom sheet on
 * phones. Focus is trapped; Esc and a backdrop click close it.
 */
export function ModalContent({
  title,
  description,
  icon,
  className,
  children,
  ...props
}: ModalContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-300 bg-backdrop backdrop-blur-sm data-[state=open]:animate-fade-in" />
      <Dialog.Content
        // Without a description Radix wants aria-describedby explicitly unset.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed z-300 overflow-y-auto bg-surface shadow-modal focus:outline-none data-[state=open]:animate-rise-in",
          // Phones: bottom sheet.
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-modal px-5 pt-6.5 pb-[max(24px,env(safe-area-inset-bottom))]",
          // 560 px and up: centred card.
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-40px)] sm:w-[min(530px,calc(100%-40px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-modal sm:p-8",
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
            className="absolute top-3 right-3 sm:top-3.5 sm:right-4"
          >
            <X aria-hidden />
          </IconButton>
        </Dialog.Close>
        {icon && (
          <span
            aria-hidden
            className="mb-5 grid size-12 place-items-center rounded-button bg-teal text-white [&_svg]:size-6"
          >
            {icon}
          </span>
        )}
        <Dialog.Title className="pr-12 text-2xl leading-[1.15] font-extrabold tracking-[-0.03em] text-ink sm:text-3xl">
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description className="mt-2 text-sm text-muted">
            {description}
          </Dialog.Description>
        )}
        <div className="mt-6">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
