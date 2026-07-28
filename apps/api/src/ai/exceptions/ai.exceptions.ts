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

/** Thrown when the configured AI provider is unavailable or not yet integrated. */
export class ProviderUnavailableException extends AiException {
  constructor(provider: string, reason?: string) {
    super(
      `AI provider "${provider}" is unavailable${reason ? `: ${reason}` : ''}`,
      'PROVIDER_UNAVAILABLE',
    );
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
  constructor(provider: string, retryAfterMs?: number) {
    super(
      `Rate limit exceeded for provider "${provider}"${retryAfterMs ? ` — retry after ${retryAfterMs}ms` : ''}`,
      'RATE_LIMIT_EXCEEDED',
    );
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
