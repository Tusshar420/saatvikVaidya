import { createHmac } from "node:crypto";

// A small RFC 6238 TOTP (SHA-1, 6 digits, 30 s), so tests can act as an
// authenticator app.

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** The key bytes of the `secret` in an otpauth:// URI (base32). */
export function keyFromOtpAuthUri(uri: string): Buffer {
  const secret = new URL(uri).searchParams.get("secret") ?? "";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    const index = base32Alphabet.indexOf(char);
    if (index < 0) throw new Error("Not base32");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** The 6-digit code an authenticator app shows for `key` at `now`. */
export function totpCode(key: Buffer, now: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1]! & 0xf;
  const value =
    ((hash[offset]! & 0x7f) << 24) |
    (hash[offset + 1]! << 16) |
    (hash[offset + 2]! << 8) |
    hash[offset + 3]!;
  return String(value % 1_000_000).padStart(6, "0");
}
