/**
 * Public API address for the browser.
 *
 * Next.js inlines NEXT_PUBLIC_API_URL at build time, so it must be written
 * here as process.env.NEXT_PUBLIC_API_URL. Set it to the HTTPS API address
 * in production (https://<APP_IP>/api or https://<API_DOMAIN>) and rebuild.
 */
const LOCAL_API_URL = "http://localhost:3001";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Browser calls must use the host the page was opened on when the build
 * points at localhost (or the page is opened on localhost): a build that
 * inlined localhost is unreachable from the public site, and a public API
 * is blocked by CORS when the page is opened locally.
 */
export function resolveApiBaseUrl(
  pageHostname?: string,
  pageProtocol?: string,
): string {
  const configured = (
    process.env.NEXT_PUBLIC_API_URL?.trim() || LOCAL_API_URL
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
