/** True when running in the browser (sessionStorage and window exist). */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}
