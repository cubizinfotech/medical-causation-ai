export type EmailFailureCode =
  'validation' | 'configuration' | 'transient' | 'rejected';

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly code: EmailFailureCode,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}
