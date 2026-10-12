import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";

const repoRoot = path.join(__dirname, "../..");

// The server .env lives at the repository root. NEXT_PUBLIC_* values are
// inlined when `npm run build:web` runs, so this must load before the build.
loadEnvConfig(repoRoot);

// Extra hosts allowed to load the dev server (comma-separated), for example
// a LAN address. Production (`next start`) does not use this.
const devOrigins = (process.env.WEB_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Sent with every page. The site may not be framed (clickjacking), and
 * plugins, <base> tags, and form posts to other sites are blocked. Scripts
 * are not restricted by CSP here because Next.js adds inline scripts.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", ...devOrigins],
  poweredByHeader: false,
  // Standalone output is only for the optional local Docker image.
  // Production PM2 uses `next start`, which Next.js does not support
  // together with output: "standalone".
  ...(process.env.NEXT_STANDALONE === "1"
    ? { output: "standalone" as const }
    : {}),
  turbopack: {
    root: repoRoot,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
