import { EXPERT_RESEARCH_CATALOG } from '../expert-research/providers/provider-catalog';
import { dedicatedSearchRan, WebSourceProvider } from './web-source-providers';
import type { WebRecord, WebResearchDossier } from './web-research.types';
import type { WebResearchEngine } from './web-research-engine';

function record(
  over: Partial<WebRecord> & Pick<WebRecord, 'id' | 'url' | 'kind'>,
): WebRecord {
  return {
    title: over.title ?? over.id,
    snippet: null,
    summary: `${over.id} summary`,
    publishedAt: over.publishedAt ?? null,
    retrievedAt: '2026-10-21T00:00:00.000Z',
    searchProviders: ['gemini_grounding'],
    queries: over.queries ?? [],
    read: over.read ?? 'read',
    readNote: over.readNote ?? null,
    match: over.match ?? {
      level: 'strong',
      confidence: 'high',
      basis: ['name', 'specialty'],
      conflicts: [],
      quote: null,
      quoteVerified: false,
      classifiedBy: 'rules',
    },
    candidateId: null,
    claims: [],
    directoryId: over.directoryId,
    ...over,
  };
}

function dossier(
  records: WebRecord[],
  over: Partial<WebResearchDossier> = {},
): WebResearchDossier {
  return {
    ranAt: '2026-10-21T00:00:00.000Z',
    durationMs: 1,
    partial: false,
    partialNote: null,
    queriesPlanned: 4,
    queriesRun: 4,
    providers: [
      {
        providerId: 'gemini_grounding',
        name: 'Gemini',
        configured: true,
        requests: 4,
        failedRequests: 0,
        hits: 2,
        failures: [],
      },
    ],
    pagesRead: records.length,
    pagesBlocked: [],
    candidates: [],
    records,
    registries: [],
    limitations: [],
    topics: [{ topic: 'identity', queries: 2, hits: 1 }],
    ...over,
  };
}

function provider(id: string, engineDossier: WebResearchDossier) {
  const definition = EXPERT_RESEARCH_CATALOG.find((entry) => entry.id === id);
  if (!definition) throw new Error(`missing ${id}`);
  return new WebSourceProvider(definition, {
    research: () => Promise.resolve(engineDossier),
  } as unknown as WebResearchEngine);
}

const query = {
  expertName: 'Jason Demery',
  city: 'Gainesville, FL',
  specialty: 'Neuropsychology',
};

describe('WebSourceProvider coverage', () => {
  it('does not treat a global topic search as a dedicated SEAK search', async () => {
    const seak = await provider(
      'seak',
      dossier([], { topics: [{ topic: 'directories', queries: 1, hits: 0 }] }),
    ).search(query);
    expect(seak.status).toBe('skipped');
    expect(seak.outcome).toBe('unavailable');
    expect(seak.message).toMatch(/not searched as a dedicated source/i);
    expect(seak.message).not.toMatch(/no SEAK listings that name/i);
  });

  it('attributes a SEAK page only after identity matching', async () => {
    const result = await provider(
      'seak',
      dossier([
        record({
          id: 'seak-1',
          url: 'https://www.seakexperts.com/jason-demery',
          kind: 'directory',
          directoryId: 'seak',
          title: 'Jason Demery, PhD',
          match: {
            level: 'strong',
            confidence: 'high',
            basis: ['name', 'specialty', 'city'],
            conflicts: [],
            quote: 'neuropsychologist in Gainesville',
            quoteVerified: true,
            classifiedBy: 'rules',
          },
        }),
        record({
          id: 'seak-other',
          url: 'https://www.seakexperts.com/jason-other',
          kind: 'directory',
          directoryId: 'seak',
          title: 'Jason Demery, electrician',
          match: {
            level: 'other_person',
            confidence: 'low',
            basis: ['name'],
            conflicts: ['profession'],
            quote: null,
            quoteVerified: false,
            classifiedBy: 'rules',
          },
        }),
      ]),
    ).search(query);
    expect(result.status).toBe('ok');
    expect(result.items[0].raw?.identity).toMatchObject({
      verifiedBy: 'source_match',
      matchLevel: 'strong',
    });
    expect(result.items[1].summary).toMatch(/different person/i);
    expect(result.items[1].raw?.identity).toMatchObject({
      ambiguous: true,
      matchLevel: 'other_person',
    });
  });

  it('records a news empty search only when the news topic actually ran', async () => {
    const news = await provider(
      'news',
      dossier([], { topics: [{ topic: 'news', queries: 2, hits: 0 }] }),
    ).search(query);
    expect(news.status).toBe('no_result');
    expect(news.message).toMatch(/cannot prove that none exist/i);

    const notNews = await provider(
      'news',
      dossier([], { topics: [{ topic: 'identity', queries: 3, hits: 1 }] }),
    ).search(query);
    expect(notNews.status).toBe('skipped');
  });

  it('keeps a blocked directory page visible instead of an empty success', async () => {
    const result = await provider(
      'jurispro',
      dossier([], {
        pagesBlocked: [
          {
            url: 'https://www.jurispro.com/expert/demery',
            reason: 'The site presented a CAPTCHA.',
          },
        ],
      }),
    ).search(query);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toMatch(/could not be read/i);
    expect(result.items[0].summary).toMatch(/not treated as an empty/i);
    expect(result.status).toBe('ok');
  });

  it('does not count a biography as proof that every directory was searched', () => {
    const bio = dossier(
      [
        record({
          id: 'bio',
          url: 'https://ufhealth.org/jason-demery',
          kind: 'profile',
        }),
      ],
      { topics: [{ topic: 'identity', queries: 2, hits: 1 }] },
    );
    expect(dedicatedSearchRan('seak', bio)).toBe(false);
    expect(dedicatedSearchRan('news', bio)).toBe(false);
    expect(dedicatedSearchRan('expert_website', bio)).toBe(true);
  });
});
