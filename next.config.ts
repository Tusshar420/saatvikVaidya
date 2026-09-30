import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import {
  documentFileHeaders,
  documentFilePath,
  securityHeaders,
} from "./src/lib/security-headers";

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  // Next has loaded .env.local by now. Unset means "assume https".
  const siteOrigin = process.env.BETTER_AUTH_URL;

  return {
    poweredByHeader: false,
    async headers() {
      return [
        { source: "/:path*", headers: securityHeaders({ isDev, siteOrigin }) },
        // Later entries override earlier ones for the same header.
        { source: documentFilePath, headers: documentFileHeaders() },
      ];
    },
  };
}
