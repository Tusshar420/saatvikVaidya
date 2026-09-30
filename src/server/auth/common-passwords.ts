import { dictionary } from "@zxcvbn-ts/language-common";
import { passwordPolicy } from "./policy";

// ~18,000 of the most common leaked passwords that are long enough to pass
// the length rule (from zxcvbn-ts's list of ~49,000), plus a few that are
// obvious for this site. Compared case-insensitively.
const siteWords = [
  "saatvikvaidya",
  "saatvik123",
  "saatvik@123",
  "ayurveda",
  "ayurveda123",
  "ayurveda@123",
  "vaidya123",
  "vaidya@123",
];

let commonPasswords: Set<string> | undefined;

function list(): Set<string> {
  commonPasswords ??= new Set(
    [...dictionary["passwords-common"], ...siteWords]
      .map((password) => password.toLowerCase())
      .filter((password) => password.length >= passwordPolicy.minLength),
  );
  return commonPasswords;
}

export function isCommonPassword(password: string): boolean {
  return list().has(password.toLowerCase());
}
