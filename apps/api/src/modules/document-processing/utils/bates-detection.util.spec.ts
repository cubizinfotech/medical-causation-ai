import { detectBatesNumbers } from './bates-detection.util';
import { evaluateDocumentStorage } from './document-storage-policy.util';

describe('detectBatesNumbers', () => {
  it('detects prefix+digits Bates stamps from text', () => {
    const text = 'Confidential — ACME000123 produced in discovery.';
    expect(detectBatesNumbers(text)).toEqual(['ACME000123']);
  });

  it('detects labeled Bates numbers', () => {
    const text = 'See Bates No. DEF-000456 for the prior version.';
    expect(detectBatesNumbers(text)).toContain('DEF000456');
  });

  it('does not fabricate Bates numbers when none are present', () => {
    expect(detectBatesNumbers('No stamps on this page.')).toEqual([]);
  });

  it('ignores common false positives like HTTP and PMID', () => {
    const text = 'Visit HTTP 8080 and PMID 12345678 for the article.';
    expect(detectBatesNumbers(text)).not.toContain('HTTP8080');
    expect(detectBatesNumbers(text)).not.toContain('PMID12345678');
  });
});

describe('evaluateDocumentStorage', () => {
  it('rejects LexisNexis PDF storage', () => {
    const result = evaluateDocumentStorage({
      filename: 'opinion.pdf',
      extension: 'pdf',
      sourceProvider: 'lexisnexis',
      sourceUrl: 'https://advance.lexis.com/example',
      access: 'restricted',
    });
    expect(result.decision).toBe('rejected');
    expect(result.mayPersistFile).toBe(false);
    expect(result.mayPersistExtractedText).toBe(false);
  });

  it('keeps restricted sources metadata-only', () => {
    const result = evaluateDocumentStorage({
      filename: 'sealed.pdf',
      extension: 'pdf',
      access: 'restricted',
    });
    expect(result.decision).toBe('metadata_only');
    expect(result.mayPersistFile).toBe(false);
  });

  it('allows public documents when permissions permit', () => {
    const result = evaluateDocumentStorage({
      filename: 'cv.pdf',
      extension: 'pdf',
      access: 'public',
    });
    expect(result.decision).toBe('store_allowed');
    expect(result.mayPersistFile).toBe(true);
  });
});
