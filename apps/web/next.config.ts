import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const repoRoot = path.join(__dirname, "../..");

/**
 * NEXT_PUBLIC_* settings from the repository-root .env.local and .env (the
 * first one found wins; a value already in the environment wins over both).
 *
 * Next.js loads env files from apps/web before it reads this config, and
 * loadEnvConfig() then returns that cached result instead of reading the
 * root, so the root files are read here. The values are inlined into the
 * browser bundle through `env` below when `npm run build:web` runs.
 */
function rootPublicEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)$/.exec(
        line,
      );
      if (!match || match[1] in values) continue;
      const raw = match[2].trim();
      const quoted = /^(["'])(.*)\1$/.exec(raw);
      values[match[1]] = quoted ? quoted[2] : raw.replace(/\s+#.*$/, "");
    }
  }
  for (const key of Object.keys(values)) {
    const fromEnvironment = process.env[key];
    if (fromEnvironment !== undefined) values[key] = fromEnvironment;
  }
  return values;
}

const publicEnv = rootPublicEnv();

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
  env: publicEnv,
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
