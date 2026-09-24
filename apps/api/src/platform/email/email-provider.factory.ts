import { Injectable } from '@nestjs/common';
import type { EmailProviderName, EmailSettings } from '@config/config.types';
import type { IEmailProvider } from './email.types';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { TransactionalEmailProvider } from './providers/transactional-email.provider';

@Injectable()
export class EmailProviderFactory {
  create(kind: EmailProviderName, settings: EmailSettings): IEmailProvider {
    if (kind === 'smtp') return new SmtpEmailProvider(settings);
    if (kind === 'transactional') return new TransactionalEmailProvider();
    return new ConsoleEmailProvider();
  }
}
