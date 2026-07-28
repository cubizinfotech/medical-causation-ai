import { normalizeForDedup, reciprocalRankFusion } from './rag.util';

describe('rag.util', () => {
  it('should fuse ranked lists with reciprocal rank fusion', () => {
    const fused = reciprocalRankFusion(
      [
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [{ id: 'b' }, { id: 'd' }],
      ],
      60,
    );

    expect(fused.get('b')).toBeGreaterThan(fused.get('a') ?? 0);
    expect(fused.get('b')).toBeGreaterThan(fused.get('c') ?? 0);
  });

  it('should normalize text for deduplication', () => {
    expect(normalizeForDedup('Hello   World')).toBe('hello world');
  });
});
