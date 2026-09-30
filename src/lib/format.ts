const numberFormat = new Intl.NumberFormat("en-IN");

/** Indian digit grouping: 125000 -> "1,25,000". */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Rupees without paise: 10000 -> "₹10,000". */
export function formatINR(rupees: number): string {
  return `₹${numberFormat.format(rupees)}`;
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
