/**
 * Where to go after sign-in. Only paths on this site are allowed:
 * "//evil.example" and "/\evil.example" would make the browser leave it.
 */
export function safeNextPath(next: string | null | undefined): string {
  return next && /^\/(?![/\\])/.test(next) ? next : "/";
}
