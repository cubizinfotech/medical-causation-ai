import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailSettings } from '@config/config.types';
import { emailConfig } from '@config/email.config';
import { normalizeOutboundEmail } from './email-message';
import { selectEmailProvider } from './email-policy';
import { EmailProviderFactory } from './email-provider.factory';
import { EmailDeliveryError } from './email.errors';
import type {
  EmailMessage,
  EmailSendResult,
  IEmailService,
} from './email.types';
import { PLATFORM_LOG_CONTEXT } from '../logging/logging.constants';

/**
 * Sends mail through the configured adapter.
 * Local development logs the message. SMTP and transactional delivery stay off
 * until EMAIL_DELIVERY_ENABLED (or FEATURE_EMAIL) and a confirmed provider are set.
 */
@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(PLATFORM_LOG_CONTEXT.EMAIL);

  constructor(
    private readonly configService: ConfigService,
    private readonly providers: EmailProviderFactory,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const settings = this.settings();
    const outbound = normalizeOutboundEmail(message, settings);
    const kind = selectEmailProvider(settings, process.env.NODE_ENV);
    if (kind === 'console' && settings.provider !== 'console') {
      this.logger.warn(
        `Email delivery suppressed for provider=${settings.provider}. The message will be logged and not sent.`,
      );
    }

    const provider = this.providers.create(kind, settings);
    const attempts = kind === 'console' ? 1 : settings.maxAttempts;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await provider.send(outbound);
        this.logger.log(
          `Email ${result.delivered ? 'sent' : 'logged'} provider=${result.provider} id=${result.messageId} template=${outbound.templateId ?? '-'} to=${outbound.to.join(',')}`,
        );
        return result;
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof EmailDeliveryError && error.retryable;
        const reason =
          error instanceof Error ? error.message : 'Email delivery failed';
        this.logger.error(
          `Email attempt ${attempt}/${attempts} failed template=${outbound.templateId ?? '-'} retryable=${retryable} reason=${reason}`,
        );
        if (!retryable || attempt === attempts) break;
        await pause(settings.retryDelayMs * attempt);
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new EmailDeliveryError('Email delivery failed.', 'rejected', false);
  }

  private settings(): EmailSettings {
    return this.configService.get<EmailSettings>('email') ?? emailConfig();
  }
}

function pause(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
