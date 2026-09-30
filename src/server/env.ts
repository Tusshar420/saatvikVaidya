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
  if (!cached) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid server environment:\n${z.prettifyError(parsed.error)}`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}
