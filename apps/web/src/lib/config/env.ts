/**
 * Returns a required environment variable or throws at runtime.
 * Use only within lib/config — never access process.env elsewhere.
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Returns an optional environment variable with a fallback default.
 */
export function getEnv(key: string, defaultValue = ""): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Returns a boolean environment variable (true when value is "true" or "1").
 */
export function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === "true" || value === "1";
}

/**
 * Returns a numeric environment variable with a fallback default.
 */
export function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Returns true when running in the browser.
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Returns true when running on the server.
 */
export function isServer(): boolean {
  return typeof window === "undefined";
}
