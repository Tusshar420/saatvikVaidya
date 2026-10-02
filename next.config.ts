import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import {
  documentFileHeaders,
  documentFilePath,
  securityHeaders,
} from "./src/lib/security-headers";

/** The deployed version shown in the error log: APP_VERSION, else the git commit, else "dev". */
function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION.slice(0, 40);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  // Next has loaded .env.local by now. Unset means "assume https".
  const siteOrigin = process.env.BETTER_AUTH_URL;

  return {
    poweredByHeader: false,
    env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
    async headers() {
      return [
        { source: "/:path*", headers: securityHeaders({ isDev, siteOrigin }) },
        // Later entries override earlier ones for the same header.
        { source: documentFilePath, headers: documentFileHeaders() },
      ];
    },
  };
}
