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
  /**
   * Folder for uploaded files (local-disk Storage). Must be outside public/.
   * Relative paths are from the app's working directory.
   */
  STORAGE_DIR: z.string().trim().min(1).default("storage"),
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
  /**
   * The site's own origin, e.g. http://localhost:3000. The default is for
   * development only: on a server the start-up check (site-check.ts)
   * refuses to start without it.
   */
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

/**
 * The live site before launch day: with SITE_COMING_SOON=true, maintenance
 * mode stays on (with "Coming soon" wording) whatever the admin switch says,
 * from the very first start, so a new live app never shows the full site
 * early. Admins still sign in and see everything. Read at call time: remove
 * the setting and redeploy to open the site.
 */
export function isComingSoon(
  env: Partial<Record<string, string>> = process.env,
): boolean {
  return env.SITE_COMING_SOON === "true";
}

// Outgoing email. Without SMTP_HOST the dev sender just prints to the log.
const smtpEnvSchema = z.object({
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().trim().optional(),
});

export type SmtpEnv = z.infer<typeof smtpEnvSchema>;

/** The SMTP settings, or undefined when email is not set up. Read at call time. */
export function smtpEnv(): (SmtpEnv & { SMTP_HOST: string; EMAIL_FROM: string }) | undefined {
  const parsed = parseEnv(smtpEnvSchema);
  if (!parsed.SMTP_HOST) return undefined;
  return { ...parsed, SMTP_HOST: parsed.SMTP_HOST, EMAIL_FROM: parsed.EMAIL_FROM || parsed.SMTP_USER || "" };
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
