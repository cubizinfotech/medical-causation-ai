/**
 * Reject non-public HTTP(S) targets before research adapters call fetch.
 * Does not prevent DNS rebinding by itself; adapters must use fixed vendor hosts.
 */
export class UnsafeResearchUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeResearchUrlError';
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

export function assertPublicHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UnsafeResearchUrlError(
      'Research URL is not a valid absolute URL.',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeResearchUrlError('Research URL must use http or https.');
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeResearchUrlError(
      'Research URL must not include credentials.',
    );
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    throw new UnsafeResearchUrlError('Research URL is missing a host.');
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new UnsafeResearchUrlError(
      'Research URL must not target the local network.',
    );
  }

  if (hostname === '::1' || isBlockedIpLiteral(hostname)) {
    throw new UnsafeResearchUrlError(
      'Research URL must not target a private or link-local address.',
    );
  }

  return parsed;
}

function isBlockedIpLiteral(hostname: string): boolean {
  if (hostname.includes(':')) {
    // IPv6 literals: block loopback and unique-local / link-local prefixes.
    if (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') return true;
    if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;
    if (hostname.startsWith('fe80')) return true;
    return false;
  }

  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}
