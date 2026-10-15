import {
  buildKeywordSearchQuery,
  normalizeForDedup,
  reciprocalRankFusion,
} from './rag.util';

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

  it('builds an OR query of medical terms, not an AND of the whole case', () => {
    const query = buildKeywordSearchQuery({
      question:
        'Did the motor vehicle collision and mild traumatic brain injury cause or contribute to the ischemic stroke five months later?',
      injury: 'Motor Vehicle Collision: 47-year-old male driver',
      diagnosis: 'Mild traumatic brain injury; ischemic stroke',
    });
    const terms = query.split(' or ');

    expect(terms).toEqual(
      expect.arrayContaining([
        'mild',
        'traumatic',
        'brain',
        'injury',
        'ischemic',
        'stroke',
        'motor',
        'vehicle',
        'collision',
      ]),
    );
    // Generic causation words, numbers, and demographics add no topic.
    for (const noise of [
      'cause',
      'contribute',
      'later',
      'months',
      'five',
      'male',
      '47-year-old',
    ]) {
      expect(terms).not.toContain(noise);
    }
    expect(new Set(terms).size).toBe(terms.length);
  });

  it('returns an empty query when there is nothing to search for', () => {
    expect(buildKeywordSearchQuery({ question: 'Did it cause this?' })).toBe(
      '',
    );
  });
});
