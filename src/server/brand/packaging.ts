import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { isContactNumber, packagingLimits } from "@/lib/brand";
import { optionalText, requiredText } from "@/server/admin/form";

// The packaging details of a Launch Your Brand order (P2.1): what goes on
// the label. Checked when the packaging step is saved, and again from the
// draft when the order is placed.

const errors = copy.packaging.errors;

/** Collapses runs of spaces and tabs, keeping line breaks (for the address and notes). */
const tidy = (value: unknown) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ") : value;

/** Control characters other than line breaks are not allowed. */
const noControl = (text: string | null) => text === null || !/[\u0000-\u0009\u000b-\u001f\u007f]/.test(text);

export const packagingSchema = z.object({
  brandName: z.preprocess(
    tidy,
    requiredText(packagingLimits.brandName, errors.brandName).refine(
      (text) => !/[\n\u0000-\u001f\u007f]/.test(text),
      errors.brandName,
    ),
  ),
  tagline: z.preprocess(
    tidy,
    optionalText(packagingLimits.tagline, errors.tagline).refine(
      (text) => text === null || !/[\n\u0000-\u001f\u007f]/.test(text),
      errors.tagline,
    ),
  ),
  marketedByName: z.preprocess(
    tidy,
    optionalText(packagingLimits.marketedByName, errors.marketedByName).refine(
      (text) => text === null || !/[\n\u0000-\u001f\u007f]/.test(text),
      errors.marketedByName,
    ),
  ),
  marketedByAddress: z.preprocess(
    tidy,
    optionalText(packagingLimits.marketedByAddress, errors.marketedByAddress).refine(
      noControl,
      errors.marketedByAddress,
    ),
  ),
  contactPhone: z.preprocess(
    tidy,
    optionalText(packagingLimits.contactPhone, errors.contactPhone).refine(
      (text) => text === null || isContactNumber(text),
      errors.contactPhone,
    ),
  ),
  notes: z.preprocess(
    tidy,
    optionalText(packagingLimits.notes, errors.notes).refine(noControl, errors.notes),
  ),
});

export type PackagingInput = z.output<typeof packagingSchema>;

export const packagingFields = [
  "brandName",
  "tagline",
  "marketedByName",
  "marketedByAddress",
  "contactPhone",
  "notes",
] as const satisfies readonly (keyof PackagingInput)[];
