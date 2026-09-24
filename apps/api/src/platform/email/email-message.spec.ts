import type { EmailSettings } from '@config/config.types';
import { EmailDeliveryError } from './email.errors';
import { formatConsoleEmail, normalizeOutboundEmail } from './email-message';

const settings: Pick<
  EmailSettings,
  'from' | 'fromName' | 'replyTo' | 'redirectTo'
> = {
  from: 'noreply@localhost',
  fromName: 'Local Mail',
  replyTo: '',
  redirectTo: '',
};

describe('normalizeOutboundEmail', () => {
  it('builds a message with sender, recipients, and an attachment', () => {
    const outbound = normalizeOutboundEmail(
      {
        to: { email: 'records@university.edu', name: 'Registrar' },
        cc: 'copy@localhost',
        subject: 'Degree check',
        text: 'Please confirm.',
        attachments: [
          {
            filename: 'request.txt',
            content: 'hello',
            contentType: 'text/plain',
          },
        ],
        templateId: 'ewi/graduation-verification',
      },
      settings,
    );

    expect(outbound.from).toBe('Local Mail <noreply@localhost>');
    expect(outbound.to).toEqual(['Registrar <records@university.edu>']);
    expect(outbound.cc).toEqual(['copy@localhost']);
    expect(outbound.attachments).toHaveLength(1);
    expect(outbound.redirected).toBe(false);
  });

  it('replaces recipients when EMAIL_REDIRECT_TO is set', () => {
    const outbound = normalizeOutboundEmail(
      {
        to: 'records@university.edu',
        cc: 'other@university.edu',
        subject: 'Request',
        text: 'Body',
      },
      { ...settings, redirectTo: 'inbox@localhost' },
    );
    expect(outbound.to).toEqual(['inbox@localhost']);
    expect(outbound.cc).toEqual([]);
    expect(outbound.originalTo).toEqual(['records@university.edu']);
    expect(outbound.redirected).toBe(true);
    expect(formatConsoleEmail(outbound)).toContain('not sent');
    expect(formatConsoleEmail(outbound)).toContain('records@university.edu');
  });

  it('rejects an empty body, a bad recipient, and an oversized attachment', () => {
    expect(() =>
      normalizeOutboundEmail(
        { to: 'records@university.edu', subject: 'Request' },
        settings,
      ),
    ).toThrow(EmailDeliveryError);

    expect(() =>
      normalizeOutboundEmail(
        { to: 'not-an-email', subject: 'Request', text: 'Body' },
        settings,
      ),
    ).toThrow(/Invalid to email/);

    expect(() =>
      normalizeOutboundEmail(
        {
          to: 'records@university.edu',
          subject: 'Request',
          text: 'Body',
          attachments: [
            {
              filename: 'big.bin',
              content: Buffer.alloc(10 * 1024 * 1024 + 1),
            },
          ],
        },
        settings,
      ),
    ).toThrow(/10 MB/);
  });
});
