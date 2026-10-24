import "server-only";
import { brand as copy } from "@/content/brand";
import { MAX_BRAND_MIN_QTY, MAX_BRAND_UNIT_PRICE_PAISE } from "@/lib/brand";
import { rupeesToPaise } from "@/lib/format";
import { diffFields, logAdminAction } from "@/server/admin/audit";
import { db } from "@/server/db";

// The admin's CSV import of Build Your Brand terms (docs/CHUNKS.md, P2.1):
// one row per product with its minimum (also the step), branded price per
// unit and unit name. The file is checked row by row and shown as a
// preview; applying parses the same text again against the catalogue as
// it is then, and changes nothing unless every row is valid. Products not in
// the file are left as they are. Callers check the admin session first.

const errors = copy.import.errors;

/** Largest file accepted, in bytes. */
export const BRAND_IMPORT_MAX_BYTES = 200 * 1024;
/** Most data rows (not counting the heading row). */
export const BRAND_IMPORT_MAX_ROWS = 500;

const HEADINGS = ["product", "minimum", "price", "unit"] as const;

/**
 * Splits CSV text into rows of fields: commas between fields, double quotes
 * around a field that holds commas, quotes or line breaks ("" is a quote),
 * and \n, \r\n or \r between rows. Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0]!.trim() !== "") rows.push(row);
    row = [];
    field = "";
  };
  while (i < text.length) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += char;
      }
      i += 1;
      continue;
    }
    if (char === '"' && field.trim() === "") {
      quoted = true;
      field = "";
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      endRow();
      if (char === "\r" && text[i + 1] === "\n") i += 1;
    } else {
      field += char;
    }
    i += 1;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

export type ImportRow = {
  /** Line number in the file (the heading is line 1). */
  line: number;
  product: string;
  minimum: string;
  price: string;
  unit: string;
  /** The matched product, if any. */
  match: { id: number; slug: string; name: string } | null;
  /** Parsed values when the row is valid. */
  values: { minQty: number; unitPricePaise: number; unitLabel: string } | null;
  /** First problem with the row, if any. */
  error: string | null;
};

export type ImportPreview =
  | { ok: false; error: string }
  | { ok: true; rows: ImportRow[]; valid: number; invalid: number };

/** Lowercase with runs of spaces made single, for matching names. */
const nameKey = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Checks the CSV text against the catalogue as it is now. Changes nothing. */
export async function previewBrandImport(text: string): Promise<ImportPreview> {
  if (new TextEncoder().encode(text).byteLength > BRAND_IMPORT_MAX_BYTES) {
    return { ok: false, error: errors.tooLarge };
  }
  if (text.includes("\u0000")) return { ok: false, error: errors.encoding };
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length === 0) return { ok: false, error: errors.empty };
  const heading = rows[0]!.map((cell) => cell.trim().toLowerCase());
  if (heading.length !== HEADINGS.length || HEADINGS.some((name, i) => heading[i] !== name)) {
    return { ok: false, error: errors.header };
  }
  const data = rows.slice(1);
  if (data.length === 0) return { ok: false, error: errors.empty };
  if (data.length > BRAND_IMPORT_MAX_ROWS) return { ok: false, error: errors.tooMany };

  const products = await db.product.findMany({ select: { id: true, slug: true, name: true } });
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const byName = new Map<string, (typeof products)[number][]>();
  for (const product of products) {
    const key = nameKey(product.name);
    byName.set(key, [...(byName.get(key) ?? []), product]);
  }

  const seen = new Set<number>();
  const result: ImportRow[] = data.map((cells, index) => {
    const [product = "", minimum = "", price = "", unit = ""] = cells.map((cell) => cell.trim());
    const row: ImportRow = {
      line: index + 2,
      product: product.slice(0, 160),
      minimum: minimum.slice(0, 20),
      price: price.slice(0, 20),
      unit: unit.slice(0, 40),
      match: null,
      values: null,
      error: null,
    };
    const failWith = (message: string) => ({ ...row, error: message });
    if (cells.length !== HEADINGS.length) return failWith(errors.columns);

    const named = byName.get(nameKey(product)) ?? [];
    const match = bySlug.get(product.toLowerCase()) ?? (named.length === 1 ? named[0] : undefined);
    if (!match) return failWith(named.length > 1 ? errors.ambiguous : errors.product);
    row.match = { id: match.id, slug: match.slug, name: match.name };
    if (seen.has(match.id)) return failWith(errors.duplicate);
    seen.add(match.id);

    const minQty = /^\d{1,5}$/.test(minimum) ? Number(minimum) : NaN;
    if (!(minQty >= 1 && minQty <= MAX_BRAND_MIN_QTY)) return failWith(errors.minimum);
    const unitPricePaise = rupeesToPaise(price.replace(/^₹\s*/, "").replace(/,/g, ""));
    if (unitPricePaise === null || unitPricePaise <= 0 || unitPricePaise > MAX_BRAND_UNIT_PRICE_PAISE) {
      return failWith(errors.price);
    }
    if (unit.length < 1 || unit.length > 30 || /[\u0000-\u001f\u007f]/.test(unit)) {
      return failWith(errors.unit);
    }
    return { ...row, values: { minQty, unitPricePaise, unitLabel: unit } };
  });
  const invalid = result.filter((row) => row.error !== null).length;
  return { ok: true, rows: result, valid: result.length - invalid, invalid };
}

export type ApplyResult =
  | { ok: true; updated: number }
  | { ok: false; error: string; preview?: ImportPreview };

/**
 * Applies the CSV: every matched product becomes open for branded orders
 * with the row's terms, logged in the admin audit trail. Refused (nothing
 * changes) if any row has an error.
 */
export async function applyBrandImport(text: string, actorId: string): Promise<ApplyResult> {
  const preview = await previewBrandImport(text);
  if (!preview.ok) return { ok: false, error: preview.error };
  if (preview.invalid > 0) return { ok: false, error: copy.import.blocked, preview };

  const updated = await db.$transaction(async (tx) => {
    let count = 0;
    for (const row of preview.rows) {
      if (!row.match || !row.values) continue;
      const before = await tx.product.findUnique({
        where: { id: row.match.id },
        select: {
          brandEligible: true,
          brandMinQty: true,
          brandUnitPricePaise: true,
          brandUnitLabel: true,
        },
      });
      if (!before) throw new ProductGone();
      const after = {
        brandEligible: true,
        brandMinQty: row.values.minQty,
        brandUnitPricePaise: row.values.unitPricePaise,
        brandUnitLabel: row.values.unitLabel,
      };
      const changes = diffFields(before, after);
      if (Object.keys(changes).length === 0) continue;
      await tx.product.update({ where: { id: row.match.id }, data: after });
      await logAdminAction(tx, {
        actorId,
        action: "product.brand_import",
        resource: "Product",
        resourceId: row.match.id,
        changes,
      });
      count += 1;
    }
    return count;
  }).catch((error: unknown) => {
    if (error instanceof ProductGone) return null;
    throw error;
  });
  if (updated === null) return { ok: false, error: copy.import.changed };
  return { ok: true, updated };
}

class ProductGone extends Error {}
