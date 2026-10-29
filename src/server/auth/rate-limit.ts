import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/server/db";
import type { RateLimitRule } from "./policy";

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in this window (0 once the limit is reached). */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

/** The counter key for a rule and subject (a phone, email or IP). */
export function rateLimitKey(rule: RateLimitRule, subject: string): string {
  const key = `${rule.name}:${subject.toLowerCase()}`;
  // Keys must fit the 191-character column; long subjects are hashed.
  return key.length <= 120
    ? key
    : `${rule.name}:sha256:${createHash("sha256").update(subject).digest("hex")}`;
}

/**
 * Counts one request against `rule` for `subject` and says whether it's
 * allowed. Fixed windows: the first request starts a window of
 * `rule.windowSeconds`, and the count resets when it ends. Every request
 * counts, including refused ones, so hammering doesn't help.
 *
 * The increment is an atomic upsert, and its row lock is held until the count
 * is read back in the same transaction, so every request sees exactly its own
 * count and concurrent requests can't slip past the limit.
 */
export async function hitRateLimit(
  rule: RateLimitRule,
  subject: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const key = rateLimitKey(rule, subject);
  const nowMs = BigInt(now);
  const newResetAt = BigInt(now + rule.windowSeconds * 1000);

  const row = await db.$transaction(async (tx) => {
    // Assignments run left to right, so both IF()s see the old resetAtMs.
    await tx.$executeRaw`
      INSERT INTO AuthRateLimit (\`key\`, \`count\`, \`resetAtMs\`)
      VALUES (${key}, 1, ${newResetAt})
      ON DUPLICATE KEY UPDATE
        \`count\` = IF(\`resetAtMs\` <= ${nowMs}, 1, \`count\` + 1),
        \`resetAtMs\` = IF(\`resetAtMs\` <= ${nowMs}, ${newResetAt}, \`resetAtMs\`)`;
    return tx.authRateLimit.findUniqueOrThrow({ where: { key } });
  });
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(Number(row.resetAtMs - nowMs) / 1000),
  );
  // Now and then, drop windows that ended over a day ago.
  if (Math.random() < 0.01) void deleteStaleRateLimits(now);
  return {
    allowed: row.count <= rule.max,
    remaining: Math.max(0, rule.max - row.count),
    retryAfterSeconds,
  };
}

export async function deleteStaleRateLimits(
  now: number = Date.now(),
): Promise<void> {
  await db.authRateLimit
    .deleteMany({ where: { resetAtMs: { lt: BigInt(now - 24 * 3600_000) } } })
    .catch((error: unknown) => {
      console.error("[auth] couldn't clear old rate-limit rows", error);
    });
}
