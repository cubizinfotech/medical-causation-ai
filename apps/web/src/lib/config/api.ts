import { getEnv } from "./env";

/**
 * API endpoint configuration.
 * NEXT_PUBLIC_API_URL is inlined at build time by Next.js.
 */
export const apiConfig = {
  baseUrl: getEnv("NEXT_PUBLIC_API_URL", "http://localhost:3001"),
  timeoutMs: Number(getEnv("NEXT_PUBLIC_API_TIMEOUT_MS", "30000")),
} as const;

/**
 * Builds a full API URL from a path segment.
 * Example: apiUrl('/cases') → 'http://localhost:3001/cases'
 */
export function apiUrl(path: string): string {
  const base = apiConfig.baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
