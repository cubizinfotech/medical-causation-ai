/** Key formats that must never reach logs, job records, or the browser. */
const SECRET_PATTERNS: RegExp[] = [
  // Google API keys (Gemini)
  /AIza[0-9A-Za-z_-]{20,}/g,
  // OpenAI, Anthropic, OpenRouter, Mistral style keys
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  // Groq keys
  /\bgsk_[A-Za-z0-9]{16,}/g,
];

const BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi;
const QUERY_SECRET_PATTERN = /([?&](?:key|api_key|apikey|token)=)[^&\s"']+/gi;
const SECRET_ENV_NAME = /(API_KEY|_TOKEN|_SECRET|PASSWORD)$/;

/** Configured secret values, longest first, so a key never appears verbatim. */
function configuredSecrets(): string[] {
  return Object.entries(process.env)
    .filter(
      ([name, value]) =>
        SECRET_ENV_NAME.test(name) &&
        typeof value === 'string' &&
        value.length >= 12,
    )
    .map(([, value]) => value as string)
    .sort((a, b) => b.length - a.length);
}

/**
 * Removes API keys and tokens from text before it is logged or stored.
 * Provider error bodies sometimes echo request details; this keeps keys out.
 */
export function redactSecrets(text: string): string {
  let result = text;
  for (const secret of configuredSecrets()) {
    result = result.split(secret).join('[redacted]');
  }
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[redacted]');
  }
  return result
    .replace(BEARER_PATTERN, '$1[redacted]')
    .replace(QUERY_SECRET_PATTERN, '$1[redacted]');
}

/** A short, secret-free description of an error for logs. */
export function describeError(error: unknown, maxLength = 300): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';
  const redacted = redactSecrets(message).replace(/\s+/g, ' ').trim();
  return redacted.length > maxLength
    ? `${redacted.slice(0, maxLength)}…`
    : redacted;
}
