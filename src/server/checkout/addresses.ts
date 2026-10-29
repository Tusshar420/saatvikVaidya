import "server-only";
import { z } from "zod";
import { checkout as copy } from "@/content/checkout";
import { indianStateCodes, pincodeMatchesState, pincodePattern } from "@/lib/india";
import { toIndianE164 } from "@/lib/phone";
import { fieldErrorsOf, type FormState } from "@/server/admin/form";
import { db } from "@/server/db";

// Saved delivery addresses. Each user manages only their own: every read and
// write is scoped by userId, and someone else's address id is "not found".

/** The most addresses one account may save. */
export const MAX_ADDRESSES = 20;

const errors = copy.address.errors;

const text = (max: number, message: string) =>
  z.string({ error: message }).trim().min(1, message).max(max, message);

const optionalText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string({ error: message }).trim().max(max, message).optional(),
  );

/** An address from the form. The phone is stored as "+91XXXXXXXXXX". */
export const addressInputSchema = z
  .object({
    name: text(100, errors.name),
    phone: z
      .string({ error: errors.phone })
      .transform((value, ctx) => {
        const e164 = toIndianE164(value);
        if (!e164) {
          ctx.addIssue({ code: "custom", message: errors.phone });
          return z.NEVER;
        }
        return e164;
      }),
    line1: text(200, errors.line1),
    line2: optionalText(200, errors.line2),
    landmark: optionalText(120, errors.landmark),
    city: text(100, errors.city),
    state: z.enum(indianStateCodes, { error: errors.state }),
    pincode: z
      .string({ error: errors.pincode })
      .trim()
      .regex(pincodePattern, errors.pincode),
  })
  .strip()
  .superRefine((address, ctx) => {
    if (!pincodeMatchesState(address.pincode, address.state)) {
      ctx.addIssue({ code: "custom", path: ["pincode"], message: errors.pincodeState });
    }
  });

export type AddressInput = z.output<typeof addressInputSchema>;

export type ParsedAddress =
  | { success: true; data: AddressInput }
  | { success: false; fieldErrors: Record<string, string> };

export function parseAddress(values: Record<string, string>): ParsedAddress {
  const parsed = addressInputSchema.safeParse(values);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, fieldErrors: fieldErrorsOf(parsed.error) };
}

const addressSelect = {
  id: true,
  name: true,
  phone: true,
  line1: true,
  line2: true,
  landmark: true,
  city: true,
  state: true,
  pincode: true,
} as const;

export type SavedAddress = {
  id: number;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
};

/** The user's addresses, the last used (then the newest) first. */
export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  return db.address.findMany({
    where: { userId },
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
    select: addressSelect,
  });
}

export async function findAddress(userId: string, id: number): Promise<SavedAddress | null> {
  return db.address.findFirst({ where: { id, userId }, select: addressSelect });
}

const toColumns = (input: AddressInput) => ({
  name: input.name,
  phone: input.phone,
  line1: input.line1,
  line2: input.line2 ?? null,
  landmark: input.landmark ?? null,
  city: input.city,
  state: input.state,
  pincode: input.pincode,
});

export type AddressSave =
  | { ok: true; id: number }
  | { ok: false; error: "too_many" | "not_found" };

export async function createAddress(userId: string, input: AddressInput): Promise<AddressSave> {
  const count = await db.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) return { ok: false, error: "too_many" };
  const created = await db.address.create({
    data: { userId, ...toColumns(input) },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updateAddress(
  userId: string,
  id: number,
  input: AddressInput,
): Promise<AddressSave> {
  const { count } = await db.address.updateMany({
    where: { id, userId },
    data: toColumns(input),
  });
  return count === 1 ? { ok: true, id } : { ok: false, error: "not_found" };
}

/** Removes one of the user's own addresses. Past orders keep their own copy. */
export async function deleteAddress(userId: string, id: number): Promise<boolean> {
  const { count } = await db.address.deleteMany({ where: { id, userId } });
  return count === 1;
}

export type AddressFormState = FormState & { savedId?: number };

const addressIdSchema = z.coerce.number().int().positive().max(2_147_483_647);

/**
 * Saves the address form (create, or update when `values.id` is set) for the
 * user and says what to show. Shared by checkout and /account/addresses.
 */
export async function saveAddressFromForm(
  userId: string,
  values: Record<string, string>,
): Promise<AddressFormState> {
  const parsed = parseAddress(values);
  if (!parsed.success) {
    return { status: "error", message: errors.form, fieldErrors: parsed.fieldErrors, values };
  }
  let result: AddressSave;
  if (values.id) {
    const id = addressIdSchema.safeParse(values.id);
    if (!id.success) return { status: "error", message: errors.notFound, values };
    result = await updateAddress(userId, id.data, parsed.data);
  } else {
    result = await createAddress(userId, parsed.data);
  }
  if (!result.ok) {
    return {
      status: "error",
      message: result.error === "too_many" ? errors.tooMany(MAX_ADDRESSES) : errors.notFound,
      values,
    };
  }
  return { status: "success", message: copy.address.saved, savedId: result.id };
}
