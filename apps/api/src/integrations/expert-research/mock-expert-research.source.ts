import type {
  ExpertResearchQuery,
  ExpertResearchSourceResult,
  IExpertResearchSource,
} from './expert-research.types';

/**
 * Deterministic mock source for local/dev without paid APIs.
 */
export class MockExpertResearchSource implements IExpertResearchSource {
  readonly sourceId = 'mock' as const;

  isEnabled(): boolean {
    return true;
  }

  search(query: ExpertResearchQuery): Promise<ExpertResearchSourceResult> {
    const { expertName, specialty } = query;
    const slug = expertName.toLowerCase().replace(/\s+/g, '-');

    return Promise.resolve({
      sourceId: this.sourceId,
      status: 'ok',
      message: 'Deterministic mock research fixtures',
      items: [
        {
          sourceId: this.sourceId,
          category: 'profile',
          title: `${expertName} — professional profile`,
          summary: `Mock CV summary for ${expertName}, specializing in ${specialty}.`,
          url: `https://example.local/experts/${slug}`,
          simulated: true,
          raw: { degrees: ['MD', 'PhD'], yearsInPractice: 18 },
        },
        {
          sourceId: this.sourceId,
          category: 'education',
          title: 'Medical School',
          summary: `Mock University School of Medicine — ${specialty} track.`,
          simulated: true,
        },
        {
          sourceId: this.sourceId,
          category: 'license',
          title: 'State medical license',
          summary:
            'Mock active license in CA; board certification listed as current.',
          url: 'https://example.local/boards/ca',
          simulated: true,
          raw: { status: 'active', state: 'CA' },
        },
        {
          sourceId: this.sourceId,
          category: 'license',
          title: 'Website credential claim',
          summary: `Personal website claims board certification in ${specialty} and NY license.`,
          url: `https://example.local/experts/${slug}/about`,
          simulated: true,
          raw: { claimedStates: ['CA', 'NY'], claimedBoard: specialty },
        },
        {
          sourceId: this.sourceId,
          category: 'publication',
          title: `Outcomes in ${specialty}: a retrospective review`,
          summary: 'Mock peer-reviewed publication (2019).',
          url: 'https://pubmed.example.local/123456',
          simulated: true,
        },
        {
          sourceId: this.sourceId,
          category: 'publication',
          title: 'Curriculum vitae publication list',
          summary:
            'CV lists 42 publications; mock index found 38 matching titles.',
          simulated: true,
          raw: { cvCount: 42, indexedCount: 38 },
        },
        {
          sourceId: this.sourceId,
          category: 'legal',
          title: 'Prior expert testimony',
          summary:
            'Mock CourtListener hit: retained as plaintiff expert in 2 federal cases.',
          url: 'https://www.courtlistener.com/example',
          simulated: true,
        },
        {
          sourceId: this.sourceId,
          category: 'directory',
          title: 'Expert witness directory listing',
          summary: `Listed for ${specialty} with hourly rate disclosed.`,
          simulated: true,
        },
        {
          sourceId: this.sourceId,
          category: 'news',
          title: 'Local news mention',
          summary: `${expertName} quoted on ${specialty} standards of care.`,
          simulated: true,
        },
        {
          sourceId: this.sourceId,
          category: 'patent',
          title: 'USPTO patent application',
          summary: 'Mock patent related to surgical instrumentation.',
          simulated: true,
        },
      ],
    });
  }
}
