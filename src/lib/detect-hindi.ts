// Detect if a string contains Devanagari script (Hindi).
const devanagariRegex = /[ऀ-ॿ]/;

export function hasDevanagari(text: string): boolean {
  return devanagariRegex.test(text);
}
