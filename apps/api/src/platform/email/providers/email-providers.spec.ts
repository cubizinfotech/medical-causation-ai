import type { OutboundEmail } from '../email.types';
import { EmailDeliveryError } from '../email.errors';
import { SmtpEmailProvider, type SmtpTransport } from './smtp-email.provider';
import { TransactionalEmailProvider } from './transactional-email.provider';

const message: OutboundEmail = {
  from: 'Local <noreply@localhost>',
  replyTo: 'reply@localhost',
  to: ['records@university.edu'],
  cc: [],
  bcc: [],
  originalTo: ['records@university.edu'],
  redirected: false,
  subject: 'Request',
  text: 'Body',
  html: '<p>Body</p>',
  attachments: [
    { filename: 'note.txt', content: 'hello', contentType: 'text/plain' },
  ],
  templateId: 'ewi/foia-request',
};

describe('email providers', () => {
  it('sends SMTP fields and attachments through the injected transport', async () => {
    const sendMail = jest.fn(() => Promise.resolve({ messageId: 'smtp-id' }));
    const transport: SmtpTransport = { sendMail };
    const provider = new SmtpEmailProvider(
      {
        host: 'localhost',
        port: 1025,
        secure: false,
        user: '',
        password: 'super-secret-pass',
      },
      transport,
    );

    const result = await provider.send(message);
    expect(result).toEqual({
      provider: 'smtp',
      messageId: 'smtp-id',
      delivered: true,
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: message.from,
        to: message.to,
        replyTo: 'reply@localhost',
        subject: 'Request',
        attachments: [
          expect.objectContaining({ filename: 'note.txt', content: 'hello' }),
        ],
      }),
    );
  });

  it('marks SMTP timeouts as retryable', async () => {
    const sendMail = jest.fn(() =>
      Promise.reject(
        Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }),
      ),
    );
    const transport: SmtpTransport = { sendMail };
    const provider = new SmtpEmailProvider(
      {
        host: 'localhost',
        port: 1025,
        secure: false,
        user: '',
        password: '',
      },
      transport,
    );
    await expect(provider.send(message)).rejects.toMatchObject({
      retryable: true,
      code: 'transient',
    });
  });

  it('refuses transactional delivery without calling a vendor', async () => {
    const provider = new TransactionalEmailProvider();
    await expect(provider.send(message)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    await expect(provider.send(message)).rejects.toThrow(/not connected/);
  });
});
