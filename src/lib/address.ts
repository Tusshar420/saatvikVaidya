import { indianStateName } from "./india";
import { formatIndianPhone } from "./phone";

// Display helpers for delivery addresses (saved ones and order snapshots).

export type AddressParts = {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
};

/** The address as lines for display, without the name and phone. */
export function addressLines(address: AddressParts): string[] {
  return [
    address.line1,
    address.line2,
    address.landmark,
    `${address.city}, ${indianStateName(address.state)} ${address.pincode}`,
  ].filter((line): line is string => Boolean(line));
}

/** One line: "Asha Rao, 12 MG Road, Pune, Maharashtra 411001". */
export function addressOneLine(address: AddressParts): string {
  return [address.name, ...addressLines(address)].join(", ");
}

/** The phone for display: "+91 98765 43210". */
export const addressPhone = (address: Pick<AddressParts, "phone">) =>
  formatIndianPhone(address.phone);
