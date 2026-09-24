import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { formatConsoleEmail } from '../email-message';
import type {
  EmailSendResult,
  IEmailProvider,
  OutboundEmail,
} from '../email.types';

/**
 * Local and test adapter. Writes the message to the log and does not transmit it.
 */
export class ConsoleEmailProvider implements IEmailProvider {
  readonly name = 'console' as const;

  constructor(
    private readonly logger = new Logger(ConsoleEmailProvider.name),
  ) {}

  send(message: OutboundEmail): Promise<EmailSendResult> {
    this.logger.log(formatConsoleEmail(message));
    return Promise.resolve({
      provider: 'console',
      messageId: `console-${randomUUID()}`,
      delivered: false,
    });
  }
}
