import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge needs to know our custom token names, otherwise it reads
// `text-h2` as a colour (and drops it next to `text-teal`) or `bg-hero` as a
// background colour.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "h2", "h3", "body-lg", "body", "small", "label"],
      shadow: ["card", "raised", "modal", "cta"],
      radius: ["button", "modal"],
    },
    classGroups: {
      "bg-image": [
        {
          bg: [
            "hero",
            "learning",
            "learning-poster",
            "offer-orange",
            "offer-teal",
            "offer-navy",
            "quiz",
            "profile",
            "brand-mark",
            "coin",
          ],
        },
      ],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
