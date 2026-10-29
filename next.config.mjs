// Plain JavaScript on purpose: Hostinger's server is too old for Next's native
// compiler, and the fallback compiler cannot read a next.config.ts. Node loads
// this file directly. The .ts import below works through Node's built-in type
// stripping (Node 22.18+ / 24).
import { execSync } from "node:child_process";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import {
  documentFileHeaders,
  documentFilePath,
  securityHeaders,
} from "./src/lib/security-headers.ts";

/** The deployed version shown in the error log: APP_VERSION, else the git commit, else "dev". */
function appVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION.slice(0, 40);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

/** @param {string} phase */
export default function config(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  // Next has loaded .env.local by now. Unset means "assume https".
  const siteOrigin = process.env.BETTER_AUTH_URL;

  return {
    poweredByHeader: false,
    // Hostinger looks for a standalone build when it checks the output.
    output: "standalone",
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
