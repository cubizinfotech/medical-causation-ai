import {
  ConfigurationErrorException,
  ProviderUnavailableException,
  RateLimitExceededException,
  TokenLimitExceededException,
} from '../exceptions';

/** What to tell a user about a failed AI step. Never includes provider text. */
export interface AiFailureMessage {
  code: string;
  message: string;
}

/**
 * Plain-English description of an AI failure, or null when the error did not
 * come from the AI layer. `task` completes the sentence, e.g. "the analysis".
 */
export function describeAiFailure(
  error: unknown,
  task: string,
): AiFailureMessage | null {
  if (error instanceof RateLimitExceededException) {
    return error.quotaExhausted
      ? {
          code: 'AI_QUOTA_EXHAUSTED',
          message: `The AI service has used up its quota for now, so ${task} could not finish. Please try again later, or ask your administrator to raise the quota.`,
        }
      : {
          code: 'AI_BUSY',
          message: `The AI service is busy right now, so ${task} could not finish. Please try again in a few minutes.`,
        };
  }
  if (error instanceof ConfigurationErrorException) {
    return {
      code: 'AI_CONFIGURATION',
      message: `The AI service is not set up correctly, so ${task} could not run. Please contact your administrator.`,
    };
  }
  if (error instanceof ProviderUnavailableException) {
    switch (error.failure) {
      case 'auth':
      case 'not_found':
      case 'invalid_request':
        return {
          code: 'AI_CONFIGURATION',
          message: `The AI service is not set up correctly, so ${task} could not run. Please contact your administrator.`,
        };
      case 'timeout':
        return {
          code: 'AI_TIMEOUT',
          message: `The AI service took too long to respond, so ${task} could not finish. Please try again.`,
        };
      default:
        return {
          code: 'AI_UNAVAILABLE',
          message: `The AI service could not be reached, so ${task} could not finish. Please try again in a few minutes.`,
        };
    }
  }
  if (error instanceof TokenLimitExceededException) {
    return {
      code: 'AI_INPUT_TOO_LARGE',
      message: `This case has more text than can be analyzed at once. Remove some records or shorten the case details, then try again.`,
    };
  }
  return null;
}
