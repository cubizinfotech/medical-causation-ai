/**
 * Single public API address for the browser.
 *
 * Next.js only reads NEXT_PUBLIC_API_URL when it is written here as
 * process.env.NEXT_PUBLIC_API_URL. A helper that looks up the name at
 * runtime always falls back to localhost in the built site.
 *
 * Leave the env value empty to use DEFAULT_API_URL.
 * Set NEXT_PUBLIC_API_URL when you move to a domain, then rebuild the web app.
 */

export const DEFAULT_API_URL = "http://157.230.156.87:3001";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Browser calls must use the host the page was opened on.
 * A build that inlined localhost is unreachable from the public site, and a
 * public default is blocked by CORS when the page is opened on localhost.
 */
export function resolveApiBaseUrl(
  pageHostname?: string,
  pageProtocol?: string,
): string {
  const configured = (
    process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL
  ).replace(/\/$/, "");

  if (!pageHostname) return configured;

  try {
    const api = new URL(configured);
    const pageIsLocal = LOCAL_HOSTS.has(pageHostname);
    const apiIsLocal = LOCAL_HOSTS.has(api.hostname);
    if (pageHostname !== api.hostname && (pageIsLocal || apiIsLocal)) {
      api.hostname = pageHostname;
      if (pageProtocol === "http:" || pageProtocol === "https:") {
        api.protocol = pageProtocol;
      }
      return api.toString().replace(/\/$/, "");
    }
    return configured;
  } catch {
    return configured;
  }
}

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return resolveApiBaseUrl();
  return resolveApiBaseUrl(window.location.hostname, window.location.protocol);
}

export const API_BASE_URL = getApiBaseUrl();
