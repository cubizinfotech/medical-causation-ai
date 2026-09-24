import { EmailDeliveryError } from '../email.errors';
import type {
  EmailSendResult,
  IEmailProvider,
  OutboundEmail,
} from '../email.types';

/**
 * Seam for a future transactional vendor (SES, Postmark, and similar).
 * No vendor HTTP client is connected. Enabling this provider fails the send
 * instead of contacting a third party.
 */
export class TransactionalEmailProvider implements IEmailProvider {
  readonly name = 'transactional' as const;

  send(message: OutboundEmail): Promise<EmailSendResult> {
    void message;
    return Promise.reject(
      new EmailDeliveryError(
        'Transactional email is not connected. No message was sent. Confirm the vendor before enabling delivery.',
        'configuration',
        false,
      ),
    );
  }
}
