import { getApiBaseUrl } from "./api-url";

/**
 * API endpoint configuration.
 * The address comes from lib/config/api-url.ts.
 */
export const apiConfig = {
  get baseUrl() {
    return getApiBaseUrl();
  },
};

/**
 * Builds a full API URL from a path segment.
 * Example: apiUrl('/health') → 'https://api.example.com/health'
 */
export function apiUrl(path: string): string {
  const base = apiConfig.baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export const AUTH_TOKEN_KEY = "auth:access-token";

/** Fired on window when the API rejects the saved session (expired or revoked). */
export const AUTH_EXPIRED_EVENT = "auth:expired";

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
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(apiUrl(path), { ...init, headers });
  if (response.status === 401 && token && getAccessToken() === token) {
    setAccessToken(null);
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return response;
}
