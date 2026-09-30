import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { securityHeaders } from "./src/lib/security-headers";

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    poweredByHeader: false,
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders({ isDev }) }];
    },
  };
}
