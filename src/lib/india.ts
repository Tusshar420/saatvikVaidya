// Indian states and union territories, and PIN code checks, for delivery
// addresses. Shared by the address form (browser) and the server, which
// checks every address again with Zod.
//
// `code` is the ISO 3166-2:IN code (stored on addresses and orders).
// `gstCode` is the two-digit GST state code, for invoices (P1.6).
// `pinZones` are the first digits of the PIN codes used in that state: the
// first digit of an Indian PIN code is its postal zone, so a mismatch means
// the PIN or the state is wrong. Zone 9 is the Army Postal Service, which
// isn't a delivery address.

export type IndianState = {
  code: string;
  name: string;
  gstCode: string;
  pinZones: readonly number[];
};

export const indianStates = [
  { code: "AN", name: "Andaman and Nicobar Islands", gstCode: "35", pinZones: [7] },
  { code: "AP", name: "Andhra Pradesh", gstCode: "37", pinZones: [5] },
  { code: "AR", name: "Arunachal Pradesh", gstCode: "12", pinZones: [7] },
  { code: "AS", name: "Assam", gstCode: "18", pinZones: [7] },
  { code: "BR", name: "Bihar", gstCode: "10", pinZones: [8] },
  { code: "CH", name: "Chandigarh", gstCode: "04", pinZones: [1] },
  { code: "CG", name: "Chhattisgarh", gstCode: "22", pinZones: [4] },
  {
    code: "DH",
    name: "Dadra and Nagar Haveli and Daman and Diu",
    gstCode: "26",
    pinZones: [3],
  },
  { code: "DL", name: "Delhi", gstCode: "07", pinZones: [1] },
  { code: "GA", name: "Goa", gstCode: "30", pinZones: [4] },
  { code: "GJ", name: "Gujarat", gstCode: "24", pinZones: [3] },
  { code: "HR", name: "Haryana", gstCode: "06", pinZones: [1] },
  { code: "HP", name: "Himachal Pradesh", gstCode: "02", pinZones: [1] },
  { code: "JK", name: "Jammu and Kashmir", gstCode: "01", pinZones: [1] },
  { code: "JH", name: "Jharkhand", gstCode: "20", pinZones: [8] },
  { code: "KA", name: "Karnataka", gstCode: "29", pinZones: [5] },
  { code: "KL", name: "Kerala", gstCode: "32", pinZones: [6] },
  { code: "LA", name: "Ladakh", gstCode: "38", pinZones: [1] },
  { code: "LD", name: "Lakshadweep", gstCode: "31", pinZones: [6] },
  { code: "MP", name: "Madhya Pradesh", gstCode: "23", pinZones: [4] },
  { code: "MH", name: "Maharashtra", gstCode: "27", pinZones: [4] },
  { code: "MN", name: "Manipur", gstCode: "14", pinZones: [7] },
  { code: "ML", name: "Meghalaya", gstCode: "17", pinZones: [7] },
  { code: "MZ", name: "Mizoram", gstCode: "15", pinZones: [7] },
  { code: "NL", name: "Nagaland", gstCode: "13", pinZones: [7] },
  { code: "OD", name: "Odisha", gstCode: "21", pinZones: [7] },
  // Puducherry's districts sit in three states: Yanam (5), Puducherry and
  // Karaikal (6), Mahe (6).
  { code: "PY", name: "Puducherry", gstCode: "34", pinZones: [5, 6] },
  { code: "PB", name: "Punjab", gstCode: "03", pinZones: [1] },
  { code: "RJ", name: "Rajasthan", gstCode: "08", pinZones: [3] },
  { code: "SK", name: "Sikkim", gstCode: "11", pinZones: [7] },
  { code: "TN", name: "Tamil Nadu", gstCode: "33", pinZones: [6] },
  { code: "TS", name: "Telangana", gstCode: "36", pinZones: [5] },
  { code: "TR", name: "Tripura", gstCode: "16", pinZones: [7] },
  { code: "UP", name: "Uttar Pradesh", gstCode: "09", pinZones: [2] },
  { code: "UK", name: "Uttarakhand", gstCode: "05", pinZones: [2] },
  { code: "WB", name: "West Bengal", gstCode: "19", pinZones: [7] },
] as const satisfies readonly IndianState[];

export type IndianStateCode = (typeof indianStates)[number]["code"];

export const indianStateCodes = indianStates.map((s) => s.code) as [
  IndianStateCode,
  ...IndianStateCode[],
];

const byCode = new Map<string, IndianState>(indianStates.map((s) => [s.code, s]));

/** The state for a code, or undefined. */
export function indianState(code: string): IndianState | undefined {
  return byCode.get(code);
}

/** The state's name for display, or the code itself if it's unknown. */
export function indianStateName(code: string): string {
  return byCode.get(code)?.name ?? code;
}

/** Six digits, not starting with 0. */
export const pincodePattern = /^[1-9]\d{5}$/;

/** True if `pincode` is well formed and in one of the state's postal zones. */
export function pincodeMatchesState(pincode: string, stateCode: string): boolean {
  const state = byCode.get(stateCode);
  if (!state || !pincodePattern.test(pincode)) return false;
  return state.pinZones.includes(Number(pincode[0]));
}
