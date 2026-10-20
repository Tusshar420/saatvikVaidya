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

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "scrollbar-none flex gap-5 overflow-x-auto border-b border-line",
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
