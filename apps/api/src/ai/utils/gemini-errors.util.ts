import { describeError } from './redact-secrets.util';

export type GeminiErrorKind =
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'invalid_request'
  | 'rate_limit'
  | 'quota'
  | 'timeout'
  | 'server'
  | 'network'
  | 'unknown';

export interface GeminiErrorInfo {
  kind: GeminiErrorKind;
  status?: number;
  /** True when the same request may succeed if sent again. */
  retryable: boolean;
  /** The wait Google asked for (RetryInfo), when it gave one. */
  retryAfterMs?: number;
  /** Short, secret-free description for logs. Never shown to users. */
  detail: string;
}

const NETWORK_ERROR =
  /fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up|network/i;

function statusOf(error: unknown, message: string): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 100) return status;
  const match =
    message.match(/"code"\s*:\s*(\d{3})/) ??
    message.match(/got status:\s*(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

/** Google's RetryInfo, e.g. "retryDelay": "31s" or "Please retry in 31.5s". */
function retryAfterOf(message: string): number | undefined {
  const match =
    message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ??
    message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
}

/** The "message" field of a Google error body, when the error carries one. */
function apiMessageOf(message: string): string {
  const match = message.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return match ? match[1].replace(/\\"/g, '"') : message;
}

/**
 * Sorts an error from @google/genai into what the caller should do with it:
 * retry (rate limit, overload, network), or stop (bad key, unknown model,
 * invalid request), so a request that cannot succeed is not sent again.
 */
export function classifyGeminiError(error: unknown): GeminiErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const status = statusOf(error, message);
  const detail = describeError(apiMessageOf(message), 240);

  if (name === 'AbortError' || name === 'TimeoutError') {
    return { kind: 'timeout', retryable: true, detail: 'request timed out' };
  }
  if (
    /API_KEY_INVALID|API key not valid|API key expired/i.test(message) ||
    status === 401
  ) {
    return { kind: 'auth', status, retryable: false, detail };
  }
  if (status === 403 || /PERMISSION_DENIED/.test(message)) {
    return { kind: 'permission', status, retryable: false, detail };
  }
  if (status === 404) {
    return { kind: 'not_found', status, retryable: false, detail };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/.test(message)) {
    // A daily quota does not come back within a job; a per-minute limit does.
    const daily = /per ?day|PerDay/i.test(message);
    return {
      kind: daily ? 'quota' : 'rate_limit',
      status,
      retryable: !daily,
      retryAfterMs: retryAfterOf(message),
      detail,
    };
  }
  if (status !== undefined && status >= 500) {
    return { kind: 'server', status, retryable: true, detail };
  }
  if (status !== undefined && status >= 400) {
    return { kind: 'invalid_request', status, retryable: false, detail };
  }
  if (NETWORK_ERROR.test(message)) {
    return { kind: 'network', retryable: true, detail };
  }
  return { kind: 'unknown', status, retryable: false, detail };
}
