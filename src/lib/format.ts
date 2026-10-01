const numberFormat = new Intl.NumberFormat("en-IN");

/** Indian digit grouping: 125000 -> "1,25,000". */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Rupees without paise: 10000 -> "₹10,000". */
export function formatINR(rupees: number): string {
  return `₹${numberFormat.format(rupees)}`;
}

const paiseFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Money stored in paise: 125000 -> "₹1,250", 125050 -> "₹1,250.50" (paise
 * shown only when there are some).
 */
export function formatPaise(paise: number): string {
  if (paise % 100 === 0) return formatINR(paise / 100);
  return `₹${paiseFormat.format(paise / 100)}`;
}

/**
 * Paise as a plain rupee amount for a form field: 125000 -> "1250",
 * 125050 -> "1250.50".
 */
export function paiseToRupeeInput(paise: number): string {
  return paise % 100 === 0
    ? String(paise / 100)
    : (paise / 100).toFixed(2);
}

/**
 * A rupee amount typed into a form ("1,250", "₹1250.5") as whole paise, or
 * null if it isn't a plain amount with at most two decimals.
 */
export function rupeesToPaise(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, rupees, decimals = ""] = match;
  return Number(rupees) * 100 + Number(decimals.padEnd(2, "0"));
}

/** Up to two initials from a name: "Abhishek Sharma" -> "AS". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? Array.from(words[0]).slice(0, 2)
      : [Array.from(words[0])[0], Array.from(words[words.length - 1])[0]];
  return letters.join("").toUpperCase();
}

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** India date: "1 Oct 2026". */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

/** India date and time: "1 Oct 2026, 2:05 pm". */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}
