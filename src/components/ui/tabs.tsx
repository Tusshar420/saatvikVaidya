"use client";

import type { ComponentProps } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

/** Underline tabs (Radix): arrow keys move between tabs. */
export function Tabs({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root className={cn("flex flex-col", className)} {...props} />
  );
}

export type TabsVariant = "underline" | "pill";

/**
 * The tab row. `pill` (v2 `.talk-tabs` / `.portal-tabs`): a row of rounded
 * pills, the active one solid brand green; its triggers pick the look up
 * from the list, so they need no prop.
 */
export function TabsList({
  className,
  variant = "underline",
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        "group/tabs scrollbar-none flex overflow-x-auto",
        variant === "pill"
          ? "gap-1.5"
          : "gap-5 border-b border-line",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative min-h-11 shrink-0 cursor-pointer px-0.5 text-sm font-extrabold whitespace-nowrap text-muted transition-colors hover:text-ink",
        "focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand after:opacity-0 after:transition-opacity",
        "data-[state=active]:text-brand data-[state=active]:after:opacity-100",
        // Pill look, when the list has variant="pill".
        "group-data-[variant=pill]/tabs:rounded-[11px] group-data-[variant=pill]/tabs:bg-cream group-data-[variant=pill]/tabs:px-3.5 group-data-[variant=pill]/tabs:text-small group-data-[variant=pill]/tabs:after:hidden",
        "group-data-[variant=pill]/tabs:data-[state=active]:bg-brand group-data-[variant=pill]/tabs:data-[state=active]:text-white",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-5 focus-visible:outline-offset-4", className)}
      {...props}
    />
  );
}
