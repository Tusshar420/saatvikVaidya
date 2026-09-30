import "server-only";
import { z } from "zod";

// Server-side environment, validated once on first use. Every variable here
// must also be listed in .env.example.
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url({
    protocol: /^mysql$/,
    error: "DATABASE_URL must be a mysql:// URL",
  }),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) cached = parseEnv(serverEnvSchema);
  return cached;
}

// Auth settings are separate so the database client and the seed don't need
// an auth secret.
const authEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  /** The site's own origin, e.g. http://localhost:3000. */
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  /** Dev only: lets the UI show the latest OTP (never in production). */
  DEV_SHOW_OTP: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

let cachedAuth: AuthEnv | undefined;

export function authEnv(): AuthEnv {
  if (!cachedAuth) cachedAuth = parseEnv(authEnvSchema);
  return cachedAuth;
}

/**
 * The dev OTP display is on only outside production and with
 * DEV_SHOW_OTP=true. Read at call time, so tests can flip it.
 */
export function isDevOtpVisible(
  env: Partial<Record<"NODE_ENV" | "DEV_SHOW_OTP", string>> = process.env,
): boolean {
  return env.NODE_ENV !== "production" && env.DEV_SHOW_OTP === "true";
}

function parseEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
