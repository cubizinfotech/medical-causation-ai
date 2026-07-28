import { getEnv } from "./env";

export const appMetadata = {
  name: "Medical Causation AI",
  description:
    "Enterprise SaaS platform for personal injury attorneys to evaluate medical causation using scientific evidence.",
  version: "0.1.0",
  phase: "Phase 3 — Demonstration UI",
} as const;

export const appConfig = {
  name: getEnv("NEXT_PUBLIC_APP_NAME", appMetadata.name),
  environment: getEnv("NODE_ENV", "development"),
  isDevelopment: getEnv("NODE_ENV", "development") === "development",
  isProduction: getEnv("NODE_ENV", "development") === "production",
} as const;
