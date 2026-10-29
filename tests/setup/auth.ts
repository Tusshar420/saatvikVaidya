import { vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { auth } from "@/server/auth";
import { devLogNotifier, type Message } from "@/server/notify";
import { userTypeSeed } from "@/server/seed/user-types";
import { clearAuthTables } from "./content-db";

// Helpers for auth tests: a clean test database with the seeded user types,
// requests through the real HTTP handler, and captured SMS/email.

export const authOrigin = "http://localhost:3000";

/** Empty auth tables and the 5 seeded user types, all active. */
export async function resetAuthData(db: PrismaClient): Promise<void> {
  await clearAuthTables(db);
  for (const type of userTypeSeed) {
    await db.userType.upsert({
      where: { key: type.key },
      create: type,
      update: { ...type, active: true },
    });
  }
}

export async function userTypeIds(
  db: PrismaClient,
): Promise<Record<string, number>> {
  const types = await db.userType.findMany({ select: { id: true, key: true } });
  return Object.fromEntries(types.map((type) => [type.key, type.id]));
}

let ipCounter = 0;

/** A fresh documentation-range IP, so each test has its own IP limits. */
export function freshIp(): string {
  ipCounter += 1;
  return `198.51.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

let phoneCounter = 0;

/** A fresh valid mobile number (10 digits, starting 9). */
export function freshPhone(): string {
  phoneCounter += 1;
  return `98${String(Date.now() % 1_000_000).padStart(6, "0")}${String(phoneCounter % 100).padStart(2, "0")}`;
}

export interface AuthCall {
  status: number;
  // The shape depends on the endpoint; tests check the fields they need.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON reply
  body: any;
  headers: Headers;
  /** "name=value" of the session cookie, if the reply set one. */
  sessionCookie: string | null;
  /** Every cookie the reply set, as a request "Cookie" header (empty ones dropped). */
  cookies: string;
}

/** POSTs `body` to /api/auth{path} through Better Auth's HTTP handler. */
export async function callAuth(
  path: string,
  body: unknown,
  options: { ip?: string; cookie?: string; method?: "GET" | "POST" } = {},
): Promise<AuthCall> {
  const method = options.method ?? "POST";
  const headers = new Headers({
    origin: authOrigin,
    "x-forwarded-for": options.ip ?? freshIp(),
  });
  if (method === "POST") headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  const response = await auth.handler(
    new Request(`${authOrigin}/api/auth${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
    }),
  );
  const text = await response.text();
  const sessionCookie =
    response.headers
      .getSetCookie()
      .find(
        (cookie) =>
          cookie.startsWith("sv.session_token=") &&
          !cookie.startsWith("sv.session_token=;"),
      )
      ?.split(";")[0] ?? null;
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0]!)
    .filter((pair) => !pair.endsWith("="))
    .join("; ");
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers,
    sessionCookie,
    cookies,
  };
}

/**
 * Captures every SMS and email instead of logging it. Call in beforeEach;
 * vi.restoreAllMocks() in afterEach undoes it.
 */
export function captureMessages(): Message[] {
  const sent: Message[] = [];
  vi.spyOn(devLogNotifier, "send").mockImplementation(async (message) => {
    sent.push(message);
  });
  return sent;
}

/** The OTP in the latest SMS to `phoneNumber` (E.164). */
export function lastOtp(sent: Message[], phoneNumber: string): string {
  const sms = sent.findLast(
    (message) => message.channel === "sms" && message.to === phoneNumber,
  );
  if (sms?.channel !== "sms" || !sms.otp) {
    throw new Error(`No OTP was sent to ${phoneNumber}`);
  }
  return sms.otp.code;
}

/** A 6-digit code that differs from `code`. */
export function wrongCode(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

export const e164 = (national: string) => `+91${national}`;
