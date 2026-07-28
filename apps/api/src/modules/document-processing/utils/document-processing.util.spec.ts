import {
  normalizeText,
  countWords,
  estimateTokens,
} from './text-normalization.util';
import { buildExtractedMetadata } from './metadata-extraction.util';
import { PARSER_TYPES } from '../constants';

describe('text-normalization.util', () => {
  it('should normalize whitespace and line endings', () => {
    const input = 'Hello   world\r\n\r\n\n\n\nSecond   paragraph\u200B';
    const result = normalizeText(input);
    expect(result).toBe('Hello world\n\nSecond paragraph');
  });

  it('should count words', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('')).toBe(0);
  });

  it('should estimate tokens', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(8))).toBe(2);
  });
});

describe('metadata-extraction.util', () => {
  it('should build extracted metadata', () => {
    const metadata = buildExtractedMetadata({
      filename: 'study.pdf',
      extension: 'pdf',
      fileSize: 1024,
      createdAt: new Date('2024-01-01'),
      modifiedAt: new Date('2024-01-02'),
      parserOutput: {
        parserType: PARSER_TYPES.PDF,
        pages: [
          {
            pageNumber: 1,
            text: 'Page one content',
            wordCount: 3,
            charCount: 16,
          },
          {
            pageNumber: 2,
            text: 'Page two content',
            wordCount: 3,
            charCount: 16,
          },
        ],
        sections: [],
        rawText: 'Page one\n\nPage two',
        pageCount: 2,
        warnings: [],
        needsOcr: false,
      },
      normalizedText: 'Page one content\n\nPage two content',
    });

    expect(metadata.pageCount).toBe(2);
    expect(metadata.wordCount).toBeGreaterThan(0);
    expect(metadata.estimatedTokens).toBeGreaterThan(0);
    expect(metadata.needsOcr).toBe(false);
  });
});
