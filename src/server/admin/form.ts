import { z } from "zod";
import { rupeesToPaise } from "@/lib/format";
import { linkTargetSchema, sitePathSchema } from "@/server/content/home-schema";

// Zod building blocks for admin forms. Server actions receive FormData, so
// every value arrives as a string (or is missing, for an unticked checkbox);
// these turn that into typed values and give each field a readable message.

/** What a form action returns when it doesn't redirect. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** First problem per field, keyed by the field's form name. */
  fieldErrors?: Record<string, string>;
  /** What was submitted, so the form can show it again after an error. */
  values?: Record<string, string>;
};

export const idleForm: FormState = { status: "idle" };

/** FormData as plain strings (files and repeated names are ignored). */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData) {
    if (typeof value === "string" && !(name in values)) values[name] = value;
  }
  return values;
}

/** The first message per field from a failed parse. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const name = issue.path.map(String).join(".") || "form";
    errors[name] ??= issue.message;
  }
  return errors;
}

/** Missing or blank form values become null. */
export const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === "string" && value.trim() === "")
    ? null
    : value;

/** Required text, trimmed, 1 to `max` characters. */
export function requiredText(max: number, message: string) {
  return z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(max, message);
}

/** Optional text: blank becomes null. */
export function optionalText(max: number, message: string) {
  return z.preprocess(
    blankToNull,
    z.string({ error: message }).trim().max(max, message).nullable(),
  );
}

/**
 * An optional price typed in rupees ("1,499" or "1499.50"), as paise; blank
 * is null. Checked on the field itself, so its message shows next to any
 * other field's.
 */
export function optionalPrice(message: string, maxPaise: number) {
  return z.preprocess(
    blankToNull,
    z
      .string({ error: message })
      .nullable()
      .transform((text, ctx) => {
        if (text === null) return null;
        const paise = rupeesToPaise(text);
        if (paise === null || paise <= 0 || paise > maxPaise) {
          ctx.addIssue({ code: "custom", message });
          return z.NEVER;
        }
        return paise;
      }),
  );
}

/** A ticked checkbox sends "on"; an unticked one sends nothing. */
export const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export function sortOrder(message: string) {
  return z.coerce
    .number({ error: message })
    .int(message)
    .min(-100_000, message)
    .max(100_000, message);
}

/** Content row key: lowercase words joined by dashes, as the seed uses. */
export function contentKey(message: string) {
  return z
    .string({ error: message })
    .trim()
    .toLowerCase()
    .max(64, message)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, message);
}

/** Link target (site path or site modal), or null when blank. */
export function optionalLinkTarget(message: string) {
  return z.preprocess(
    blankToNull,
    z
      .string({ error: message })
      .trim()
      .refine((value) => linkTargetSchema.safeParse(value).success, message)
      .nullable(),
  );
}

/** Path under public/ ("/media/x.jpg"), or null when blank. */
export function optionalMediaPath(message: string) {
  return z.preprocess(
    blankToNull,
    z
      .string({ error: message })
      .trim()
      .refine((value) => sitePathSchema.safeParse(value).success, message)
      .nullable(),
  );
}

/** Positive integer id from a route or form value. */
export const intId = z.coerce.number().int().positive().max(2_147_483_647);

/** A row's plain values (dates and objects dropped), as a form's starting values. */
export function fieldValuesOf(
  row: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const values: Record<string, string | number | boolean | null> = {};
  for (const [name, value] of Object.entries(row)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      values[name] = value;
    }
  }
  return values;
}

/** The key typed when creating a content row (see contentKey). */
export const keyOf = (value: unknown) => contentKey("Invalid key").safeParse(value);
