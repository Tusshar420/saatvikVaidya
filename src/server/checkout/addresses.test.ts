import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { checkout as copy } from "@/content/checkout";
import { pincodeMatchesState } from "@/lib/india";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeUser, validAddress } from "../../../tests/setup/shop";
import {
  createAddress,
  findAddress,
  listAddresses,
  MAX_ADDRESSES,
  parseAddress,
  updateAddress,
} from "./addresses";

// Delivery addresses (P1.4): Indian PIN code and state checks, and each
// user only ever sees their own.

const errors = copy.address.errors;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("pincodeMatchesState", () => {
  it("matches the PIN code's postal zone to the state", () => {
    expect(pincodeMatchesState("411001", "MH")).toBe(true);
    expect(pincodeMatchesState("110001", "DL")).toBe(true);
    expect(pincodeMatchesState("560001", "KA")).toBe(true);
    expect(pincodeMatchesState("682001", "KL")).toBe(true);
    expect(pincodeMatchesState("700001", "WB")).toBe(true);
    expect(pincodeMatchesState("800001", "BR")).toBe(true);
    // Puducherry's Yanam district has a 5-zone PIN code.
    expect(pincodeMatchesState("533464", "PY")).toBe(true);
    expect(pincodeMatchesState("605001", "PY")).toBe(true);
  });

  it("rejects a PIN code from another zone, bad formats and unknown states", () => {
    expect(pincodeMatchesState("110001", "MH")).toBe(false);
    expect(pincodeMatchesState("011001", "DL")).toBe(false);
    expect(pincodeMatchesState("41100", "MH")).toBe(false);
    // Zone 9 is the Army Postal Service.
    expect(pincodeMatchesState("999001", "DL")).toBe(false);
    expect(pincodeMatchesState("411001", "XX")).toBe(false);
  });
});

describe("parseAddress", () => {
  it("cleans a valid address and stores the phone as E.164", () => {
    expect(parseAddress({ ...validAddress, city: "  Pune ", extra: "ignored" })).toEqual({
      success: true,
      data: {
        name: "Asha Rao",
        phone: "+919876543210",
        line1: "Flat 4, Shanti Apartments",
        line2: "MG Road",
        landmark: undefined,
        city: "Pune",
        state: "MH",
        pincode: "411001",
      },
    });
  });

  it("explains each field's problem", () => {
    const result = parseAddress({
      name: " ",
      phone: "12345",
      line1: "",
      city: "",
      state: "ZZ",
      pincode: "4110",
    });
    expect(result).toEqual({
      success: false,
      fieldErrors: {
        name: errors.name,
        phone: errors.phone,
        line1: errors.line1,
        city: errors.city,
        state: errors.state,
        pincode: errors.pincode,
      },
    });
  });

  it("refuses a PIN code that isn't in the chosen state", () => {
    expect(parseAddress({ ...validAddress, state: "DL" })).toEqual({
      success: false,
      fieldErrors: { pincode: errors.pincodeState },
    });
  });
});

describe("saved addresses", () => {
  const parsed = () => {
    const result = parseAddress(validAddress);
    if (!result.success) throw new Error("fixture should be valid");
    return result.data;
  };

  it("creates, lists, finds and updates only the owner's addresses", async () => {
    const owner = await makeUser(db);
    const other = await makeUser(db);
    const created = await createAddress(owner, parsed());
    if (!created.ok) throw new Error("not created");

    expect(await listAddresses(owner)).toHaveLength(1);
    expect(await listAddresses(other)).toEqual([]);
    expect(await findAddress(other, created.id)).toBeNull();
    expect(await updateAddress(other, created.id, { ...parsed(), city: "Hacked" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await updateAddress(owner, created.id, { ...parsed(), city: "Mumbai", pincode: "400001" })).toEqual({
      ok: true,
      id: created.id,
    });
    expect(await findAddress(owner, created.id)).toMatchObject({ city: "Mumbai", pincode: "400001" });
  });

  it("lists the last used address first, then the newest", async () => {
    const owner = await makeUser(db);
    const first = await createAddress(owner, parsed());
    const second = await createAddress(owner, { ...parsed(), name: "Second" });
    if (!first.ok || !second.ok) throw new Error("not created");
    expect((await listAddresses(owner)).map((a) => a.id)).toEqual([second.id, first.id]);
    await db.address.update({ where: { id: first.id }, data: { lastUsedAt: new Date() } });
    expect((await listAddresses(owner)).map((a) => a.id)).toEqual([first.id, second.id]);
  });

  it(`stops at ${MAX_ADDRESSES} addresses`, async () => {
    const owner = await makeUser(db);
    for (let i = 0; i < MAX_ADDRESSES; i += 1) {
      expect((await createAddress(owner, parsed())).ok).toBe(true);
    }
    expect(await createAddress(owner, parsed())).toEqual({ ok: false, error: "too_many" });
  });
});
