import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";

const repoRoot = path.join(__dirname, "../..");

// The server .env lives at the repository root. NEXT_PUBLIC_* values are
// inlined when `npm run build:web` runs, so this must load before the build.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  // Standalone output is only for the optional local Docker image.
  // Production PM2 uses `next start`, which Next.js does not support
  // together with output: "standalone".
  ...(process.env.NEXT_STANDALONE === "1"
    ? { output: "standalone" as const }
    : {}),
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
