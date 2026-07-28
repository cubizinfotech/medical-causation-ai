import {
  buildExternalChunkId,
  estimateTokensFromText,
  splitTextSegment,
} from './chunking.util';

describe('chunking.util', () => {
  it('should estimate tokens from text', () => {
    expect(estimateTokensFromText('abcd')).toBe(1);
    expect(estimateTokensFromText('a'.repeat(8))).toBe(2);
  });

  it('should build external chunk ids', () => {
    expect(buildExternalChunkId('doc-1', 0)).toBe('doc-1:0');
  });

  it('should split long segments with overlap', () => {
    const text = 'Sentence one. '.repeat(200);
    const chunks = splitTextSegment(
      { text, pageNumber: 1, section: null },
      50,
      10,
      5,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks.every((chunk) => chunk.text.length > 0)).toBe(true);
  });
});
