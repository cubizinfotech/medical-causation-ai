import {
  blockedPageDisplayTitle,
  isBlockedChallengeTitle,
  isCourtSourceUrl,
  looksLikeCourtDocument,
} from './source-kind';

describe('source-kind court and blocked titles', () => {
  it('treats CourtListener and Justia URLs as court sources after a kind retag', () => {
    expect(isCourtSourceUrl('https://www.courtlistener.com/opinion/1/x/')).toBe(
      true,
    );
    expect(
      looksLikeCourtDocument({
        kind: 'ime',
        url: 'https://www.courtlistener.com/opinion/1/x/',
        title: 'Memorandum opinion',
      }),
    ).toBe(true);
    expect(isCourtSourceUrl('https://law.justia.com/cases/federal/1')).toBe(
      true,
    );
  });

  it('does not use a CAPTCHA challenge as a page title', () => {
    expect(isBlockedChallengeTitle('Just a moment...')).toBe(true);
    expect(isBlockedChallengeTitle('Attention Required! | Cloudflare')).toBe(
      true,
    );
    expect(
      isBlockedChallengeTitle('Enable JavaScript and cookies to continue'),
    ).toBe(true);
    expect(isBlockedChallengeTitle('Jason Demery, PhD')).toBe(false);
    expect(blockedPageDisplayTitle('https://www.jurispro.com/expert/x')).toBe(
      'jurispro.com — not read (login or bot protection)',
    );
  });
});
