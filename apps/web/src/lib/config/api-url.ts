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

const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (configuredUrl || DEFAULT_API_URL).replace(
  /\/$/,
  "",
);
