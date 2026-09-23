import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { EmailSettings } from '@config/config.types';
import type { EmailMessage, IEmailService } from './email.types';

/**
 * Local default logs messages. SMTP is used only when EMAIL_PROVIDER=smtp.
 * Credentials stay on the server.
 */
@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(message: EmailMessage): Promise<void> {
    const settings = this.configService.get<EmailSettings>('email');
    if (!settings || settings.provider === 'console') {
      this.logger.log(
        `Email (console) to=${this.formatTo(message.to)} subject="${message.subject}"`,
      );
      return;
    }

    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.user
        ? { user: settings.user, pass: settings.password }
        : undefined,
    });

    await transport.sendMail({
      from: settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private formatTo(to: string | string[]): string {
    return Array.isArray(to) ? to.join(',') : to;
  }
}
