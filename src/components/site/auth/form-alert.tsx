import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export type FormAlertProps = {
  tone?: "error" | "success";
  id?: string;
  className?: string;
  children: ReactNode;
};

/**
 * A message for the whole form (not one field). Errors are announced at once
 * (role="alert"); success messages politely (role="status").
 */
export function FormAlert({
  tone = "error",
  id,
  className,
  children,
}: FormAlertProps) {
  const error = tone === "error";
  const Icon = error ? CircleAlert : CircleCheck;
  return (
    <p
      id={id}
      role={error ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-lg p-3.5 text-sm font-medium",
        error ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-dark",
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
