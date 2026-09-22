import { DiscrepancyAnalyzer } from './discrepancy-analyzer';
import type { ExpertEvidenceItem } from '@integrations/expert-research';

describe('DiscrepancyAnalyzer', () => {
  const analyzer = new DiscrepancyAnalyzer();

  it('flags publication count gaps', () => {
    const items: ExpertEvidenceItem[] = [
      {
        sourceId: 'mock',
        category: 'publication',
        title: 'CV list',
        summary: 'gap',
        simulated: true,
        raw: { cvCount: 42, indexedCount: 38 },
      },
    ];

    const result = analyzer.analyze(items);
    expect(result.some((d) => d.id === 'publication-count-gap')).toBe(true);
  });

  it('returns review-recommended when no hard conflicts', () => {
    const items: ExpertEvidenceItem[] = [
      {
        sourceId: 'mock',
        category: 'profile',
        title: 'Profile',
        summary: 'ok',
        simulated: true,
      },
    ];

    const result = analyzer.analyze(items);
    expect(result[0]?.id).toBe('review-recommended');
  });
});
