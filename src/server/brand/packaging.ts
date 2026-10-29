import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { isContactNumber } from "@/lib/brand";
import { isHexColour, profileLimits } from "@/lib/label";
import { blankToNull, optionalText, requiredText } from "@/server/admin/form";

// What a saved brand profile holds (the shared label defaults) and the notes
// of one order. Checked when a profile is saved, and again when an order is
// placed.

const errors = copy.profiles.errors;

/** Collapses runs of spaces and tabs, keeping line breaks (for addresses and descriptions). */
const tidy = (value: unknown) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ") : value;

/** Control characters other than line breaks are not allowed. */
const noControl = (text: string | null) => text === null || !/[\u0000-\u0009\u000b-\u001f\u007f]/.test(text);

const singleLine = (text: string | null) => text === null || !/[\n\u0000-\u001f\u007f]/.test(text);

const line = (max: number, message: string) =>
  z.preprocess(tidy, optionalText(max, message).refine(singleLine, message));

const block = (max: number, message: string) =>
  z.preprocess(tidy, optionalText(max, message).refine(noControl, message));

const colour = z.preprocess(
  blankToNull,
  z
    .string({ error: errors.colour })
    .trim()
    .refine(isHexColour, errors.colour)
    .transform((value) => value.toLowerCase())
    .nullable(),
);

export const profileSchema = z.object({
  profileName: z.preprocess(
    tidy,
    requiredText(profileLimits.profileName, errors.profileName).refine(singleLine, errors.profileName),
  ),
  brandName: z.preprocess(
    tidy,
    requiredText(profileLimits.brandName, errors.brandName).refine(singleLine, errors.brandName),
  ),
  tagline: line(profileLimits.tagline, errors.tagline),
  shortDescription: line(profileLimits.shortDescription, errors.shortDescription),
  longDescription: block(profileLimits.longDescription, errors.longDescription),
  marketedByName: line(profileLimits.marketedByName, errors.marketedByName),
  marketedByAddress: block(profileLimits.marketedByAddress, errors.marketedByAddress),
  contactPhone: z.preprocess(
    tidy,
    optionalText(profileLimits.contactPhone, errors.contactPhone).refine(
      (text) => text === null || isContactNumber(text),
      errors.contactPhone,
    ),
  ),
  licenceNumbers: block(profileLimits.licenceNumbers, errors.licenceNumbers),
  primaryColour: colour,
  secondaryColour: colour,
});

export type ProfileInput = z.output<typeof profileSchema>;

export const profileFields = [
  "profileName",
  "brandName",
  "tagline",
  "shortDescription",
  "longDescription",
  "marketedByName",
  "marketedByAddress",
  "contactPhone",
  "licenceNumbers",
  "primaryColour",
  "secondaryColour",
] as const satisfies readonly (keyof ProfileInput)[];

/** Notes for the team on one order. */
export const orderNotesSchema = z.object({
  notes: z.preprocess(tidy, optionalText(1000, copy.packaging.errors.notes).refine(noControl, copy.packaging.errors.notes)),
});
