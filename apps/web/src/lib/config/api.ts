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

export const AUTH_TOKEN_KEY = "auth:access-token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

/** Fetch an API path and attach the session bearer token when one exists. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
