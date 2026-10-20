"use client";

import {
  createContext,
  use,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

export type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it hides itself. */
  duration?: number;
};

type ToastItem = ToastInput & { id: number };

const toneStyles: Record<ToastTone, { icon: ReactNode; accent: string }> = {
  success: {
    icon: <CircleCheck aria-hidden className="size-5 text-success" />,
    accent: "border-l-success",
  },
  error: {
    icon: <CircleAlert aria-hidden className="size-5 text-danger" />,
    accent: "border-l-danger",
  },
  info: {
    icon: <Info aria-hidden className="size-5 text-brand" />,
    accent: "border-l-brand",
  },
};

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * Shows toasts anywhere below it (mounted once in the root layout). On phones
 * they sit above the mobile dock; from 560 px up, bottom right.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((list) => [...list, { ...toast, id }]);
  }, []);

  const remove = (id: number) =>
    setToasts((list) => list.filter((toast) => toast.id !== id));

  return (
    <ToastContext value={show}>
      <ToastPrimitive.Provider
        swipeDirection="right"
        label={ui.toast.announceLabel}
      >
        {children}
        {toasts.map((toast) => {
          const tone = toneStyles[toast.tone ?? "success"];
          return (
            <ToastPrimitive.Root
              key={toast.id}
              duration={toast.duration ?? 5000}
              // Errors interrupt the screen reader; the rest wait their turn.
              type={toast.tone === "error" ? "foreground" : "background"}
              onOpenChange={(open) => {
                if (!open) remove(toast.id);
              }}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-l-4 border-line bg-surface p-4 shadow-raised",
                "data-[state=open]:animate-rise-in data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
                tone.accent,
              )}
            >
              <span className="mt-0.5 shrink-0">{tone.icon}</span>
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-sm font-bold text-ink">
                  {toast.title}
                </ToastPrimitive.Title>
                {toast.description && (
                  <ToastPrimitive.Description className="mt-0.5 text-small text-muted">
                    {toast.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                aria-label={ui.toast.dismiss}
                className="-m-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-surface-alt hover:text-ink"
              >
                <X aria-hidden className="size-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport
          label={ui.toast.regionLabel}
          className="fixed inset-x-3 bottom-[calc(79px+env(safe-area-inset-bottom))] z-400 flex flex-col gap-2 outline-none sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
        />
      </ToastPrimitive.Provider>
    </ToastContext>
  );
}

/** Returns `toast({ title, description, tone })`. */
export function useToast(): (toast: ToastInput) => void {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
