/**
 * Base class for all AI-related exceptions.
 */
export class AiException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Why a provider refused a request. `unavailable` covers outages and network
 * errors; the others mean the request will not succeed until the
 * configuration changes.
 */
export type ProviderFailureKind =
  'unavailable' | 'timeout' | 'auth' | 'not_found' | 'invalid_request';

/** Thrown when the configured AI provider is unavailable or not yet integrated. */
export class ProviderUnavailableException extends AiException {
  readonly provider: string;
  readonly failure: ProviderFailureKind;

  constructor(
    provider: string,
    reason?: string,
    failure: ProviderFailureKind = 'unavailable',
  ) {
    super(
      `AI provider "${provider}" is unavailable${reason ? `: ${reason}` : ''}`,
      'PROVIDER_UNAVAILABLE',
    );
    this.provider = provider;
    this.failure = failure;
  }
}

/** Thrown when the requested model is not supported by the provider. */
export class InvalidModelException extends AiException {
  constructor(model: string, provider: string) {
    super(
      `Model "${model}" is not supported by provider "${provider}"`,
      'INVALID_MODEL',
    );
  }
}

/** Thrown when the provider rate limit is exceeded. */
export class RateLimitExceededException extends AiException {
  readonly retryAfterMs?: number;
  /** A daily quota is used up: waiting a minute will not help. */
  readonly quotaExhausted: boolean;

  constructor(provider: string, retryAfterMs?: number, quotaExhausted = false) {
    super(
      quotaExhausted
        ? `Quota exhausted for provider "${provider}"`
        : `Rate limit exceeded for provider "${provider}"${retryAfterMs ? ` — retry after ${retryAfterMs}ms` : ''}`,
      'RATE_LIMIT_EXCEEDED',
    );
    this.retryAfterMs = retryAfterMs;
    this.quotaExhausted = quotaExhausted;
  }
}

/** Thrown when a request exceeds configured token limits. */
export class TokenLimitExceededException extends AiException {
  constructor(
    limitType: 'prompt' | 'completion' | 'total',
    limit: number,
    actual: number,
  ) {
    super(
      `${limitType} token limit exceeded: ${actual} tokens requested, limit is ${limit}`,
      'TOKEN_LIMIT_EXCEEDED',
    );
  }
}

/** Thrown when a prompt template is invalid or cannot be loaded. */
export class InvalidPromptException extends AiException {
  constructor(message: string) {
    super(message, 'INVALID_PROMPT');
  }
}

/** Thrown when AI configuration is missing or invalid. */
export class ConfigurationErrorException extends AiException {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

/** Thrown when an AI operation is not yet implemented. */
export class NotImplementedException extends AiException {
  constructor(operation: string) {
    super(
      `AI operation "${operation}" is not yet implemented`,
      'NOT_IMPLEMENTED',
    );
  }
}
