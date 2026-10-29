import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge needs to know our custom token names, otherwise it reads
// `text-h2` as a colour (and drops it next to `text-brand`) or `bg-hero` as a
// background colour.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "h1",
        "h2",
        "h3",
        "h4",
        "body-lg",
        "body",
        "small",
        "label",
      ],
      shadow: ["card", "raised", "modal", "cta", "gold", "forest", "dock"],
      radius: ["button", "modal"],
      font: ["body", "heading", "serif-hindi"],
    },
    classGroups: {
      // Multi-part names are nested; tailwind-merge doesn't match a
      // hyphenated literal ("pack-green") and reads it as a colour.
      "bg-image": [
        {
          bg: [
            "hero",
            "forest",
            "quiz",
            "coin",
            "avatar",
            "cta",
            "announcement",
            "dots",
            {
              page: ["hero"],
              brand: ["wash", "mark"],
              coins: ["band"],
              pack: ["green", "saffron", "blue", "gold"],
            },
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
