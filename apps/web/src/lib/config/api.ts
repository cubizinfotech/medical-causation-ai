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

/**
 * Access token lives in localStorage so every tab of this origin shares the
 * same signed-in session. sessionStorage is per-tab and caused a new tab to
 * ask for login while another tab was already signed in.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    if (stored) return stored;
    // One-time move from older per-tab storage so a refresh keeps the session.
    const legacy = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!legacy) return null;
    localStorage.setItem(AUTH_TOKEN_KEY, legacy);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Private mode or blocked storage; callers treat missing token as signed out.
  }
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
