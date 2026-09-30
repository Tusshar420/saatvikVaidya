/**
 * Turns whatever was typed or pasted into a phone field into at most 10
 * national digits. Handles pasted numbers with a +91 / 91 / 0 prefix, spaces
 * and dashes, e.g. "+91 92203-58400" -> "9220358400".
 */
export function normalizeIndianPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length > 10 && digits.startsWith("0"))
    digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** True for a full 10-digit Indian mobile number (starts 6-9). */
export function isValidIndianMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * The E.164 form ("+919876543210") of an Indian mobile number typed or pasted
 * in any common format, or null if it isn't one. Accounts store this form.
 */
export function toIndianE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let national = digits;
  if (digits.length === 12 && digits.startsWith("91"))
    national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0"))
    national = digits.slice(1);
  return isValidIndianMobile(national) ? `+91${national}` : null;
}

/** True for a stored phone number: "+91" and a valid 10-digit mobile. */
export function isIndianE164(value: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(value);
}

/** A tel: link for a displayed number: "+91 92203 58400" -> "tel:+919220358400". */
export function telHref(display: string): string {
  return `tel:+${display.replace(/\D/g, "")}`;
}

/** Display format: "+91 92203 58400". */
export function formatIndianPhone(digits: string): string {
  const national = normalizeIndianPhone(digits);
  if (national.length !== 10) return `+91 ${national}`;
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}
