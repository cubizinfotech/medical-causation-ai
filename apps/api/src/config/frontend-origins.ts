const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Browser origins allowed to call the API.
 * FRONTEND_URL may be a comma-separated list.
 * When the configured site is localhost but API_PUBLIC_URL is a public host
 * (or the reverse), the same web port on that other host is allowed too.
 */
export function frontendOrigins(
  frontendUrl: string,
  apiPublicUrl?: string,
): string[] {
  const configured = frontendUrl
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const origins = new Set<string>();
  let apiHost: string | undefined;
  if (apiPublicUrl) {
    try {
      apiHost = new URL(apiPublicUrl).hostname;
    } catch {
      apiHost = undefined;
    }
  }

  for (const entry of configured) {
    const origin = originOf(entry);
    if (!origin) continue;
    origins.add(origin);
    if (!apiHost) continue;

    const url = new URL(origin);
    const configuredIsLocal = LOCAL_HOSTS.has(url.hostname);
    const apiIsLocal = LOCAL_HOSTS.has(apiHost);
    if (configuredIsLocal === apiIsLocal) continue;
    if (url.hostname === apiHost) continue;

    const paired = new URL(url.toString());
    paired.hostname = apiHost;
    origins.add(paired.origin);
  }

  return [...origins];
}
