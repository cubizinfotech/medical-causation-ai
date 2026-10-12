import { apiConfig } from "@/lib/config";

/** Where socket.io connects for one of the API's namespaces. */
export interface SocketTarget {
  /** Origin plus namespace, e.g. "http://host/ewi". */
  url: string;
  /** Handshake path, e.g. "/socket.io" or "/api/socket.io". */
  path: string;
}

/**
 * socket.io reads the path of the URL as the namespace, so an API served
 * under a path (http://host/api, behind Caddy on one port) must keep that
 * path out of the URL and in the handshake path instead.
 */
export function socketTarget(
  namespace: string,
  baseUrl: string = apiConfig.baseUrl,
): SocketTarget {
  const base = new URL(baseUrl.replace(/\/$/, ""));
  const prefix = base.pathname.replace(/\/$/, "");
  return { url: `${base.origin}/${namespace}`, path: `${prefix}/socket.io` };
}

export function medicalAnalysisSocket(): SocketTarget {
  return socketTarget("medical-analysis");
}

export function ewiSocket(): SocketTarget {
  return socketTarget("ewi");
}
