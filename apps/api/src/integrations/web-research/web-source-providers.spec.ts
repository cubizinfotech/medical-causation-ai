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
    expect(result.items[1].raw?.identity).not.toMatchObject({
      verifiedBy: 'source_match',
    });
  });

  it('does not stamp source_match or the query name on a possible web item', async () => {
    const result = await provider(
      'seak',
      dossier([
        record({
          id: 'seak-possible',
          url: 'https://www.seakexperts.com/possible',
          kind: 'directory',
          directoryId: 'seak',
          title: 'J. Demery',
          match: {
            level: 'possible',
            confidence: 'medium',
            basis: ['surname'],
            conflicts: [],
            quote: null,
            quoteVerified: false,
            classifiedBy: 'rules',
          },
        }),
      ]),
    ).search(query);
    expect(result.items[0].raw?.identity).toMatchObject({
      matchLevel: 'possible',
      ambiguous: true,
    });
    expect(
      (result.items[0].raw?.identity as { verifiedBy?: string }).verifiedBy,
    ).toBeUndefined();
    expect(
      (result.items[0].raw?.identity as { name?: string }).name,
    ).toBeUndefined();
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

  it('treats a zero-hit site: query as a dedicated empty search, not as never searched', async () => {
    const empty = dossier([], {
      topics: [{ topic: 'directories', queries: 1, hits: 0 }],
      executedQueries: [
        {
          topic: 'directories',
          query: '"Jason Demery" site:seakexperts.com',
        },
      ],
    });
    expect(dedicatedSearchRan('seak', empty)).toBe(true);
    const seak = await provider('seak', empty).search(query);
    expect(seak.status).toBe('no_result');
    expect(seak.message).toMatch(/cannot prove that none exist/i);
    expect(seak.message).not.toMatch(/not searched as a dedicated source/i);
  });

  it('treats a patents topic with no hits as an empty public search, not unimplemented', async () => {
    const empty = dossier([], {
      topics: [{ topic: 'patents', queries: 2, hits: 0 }],
      executedQueries: [
        {
          topic: 'patents',
          query: '"Jason Demery" site:patents.google.com',
        },
      ],
    });
    const patents = await provider('patents', empty).search(query);
    expect(patents.status).toBe('no_result');
    expect(patents.outcome).toBe('no_result');
    expect(patents.message).toMatch(/cannot prove that none exist/i);
    expect(patents.message).not.toMatch(/not searched as a dedicated source/i);
  });

  it('assigns a Google Patents URL to the patents catalog source', async () => {
    const result = await provider(
      'patents',
      dossier([
        record({
          id: 'gp',
          url: 'https://patents.google.com/patent/US123',
          kind: 'other',
          title: 'US123 Demery',
        }),
      ]),
    ).search(query);
    expect(result.status).toBe('ok');
    expect(result.items[0].sourceId).toBe('patents');
    expect(result.items[0].category).toBe('patent');
    expect(result.items[0].url).toContain('patents.google.com');
  });

  it('files a forensic practice site under advertising when the page markets those services', async () => {
    const practice = dossier([
      record({
        id: 'practice',
        url: 'https://neuropsychologicalsciences.com/',
        kind: 'expert_website',
        title:
          'Forensic Psychological Assessment & Neuropsychological Evaluations',
        summary:
          'Dr. Demery provides forensic neuropsychological evaluations and independent medical examinations for attorneys.',
        claims: [
          {
            type: 'forensic',
            text: 'IME',
            quote: 'independent medical examinations for attorneys',
            topic: 'ime',
            basis: 'subject_stated',
            from: 'page',
          },
        ],
      }),
    ]);
    const ads = await provider('advertising', practice).search(query);
    expect(ads.status).toBe('ok');
    expect(ads.items[0].url).toContain('neuropsychologicalsciences.com');
    const site = await provider('expert_website', practice).search(query);
    expect(site.items[0].url).toContain('neuropsychologicalsciences.com');
  });

  it('files an expert-directory page that markets IME services under IME advertising', async () => {
    const listing = dossier([
      record({
        id: 'ei',
        url: 'https://www.expertinstitute.com/experts/jason-demery',
        kind: 'directory',
        directoryId: 'other_expert_directories',
        title: 'Jason Demery, Independent Medical Examinations',
        summary:
          'Available for independent medical examinations and forensic evaluations.',
        claims: [
          {
            type: 'forensic',
            text: 'IME',
            quote: 'independent medical examinations',
            topic: 'ime',
            basis: 'third_party',
            from: 'page',
          },
        ],
      }),
    ]);
    const ime = await provider('ime_advertising', listing).search(query);
    expect(ime.status).toBe('ok');
    expect(ime.items[0].url).toContain('expertinstitute.com');
  });

  it('treats court-document and accreditation topics as dedicated public searches', () => {
    const legal = dossier([], {
      topics: [
        { topic: 'court_documents', queries: 2, hits: 0 },
        { topic: 'litigation', queries: 1, hits: 0 },
        { topic: 'depositions', queries: 1, hits: 0 },
        { topic: 'university_accreditation', queries: 2, hits: 0 },
      ],
      executedQueries: [
        {
          topic: 'university_accreditation',
          query: '"University of Florida" site:chea.org',
        },
      ],
    });
    expect(dedicatedSearchRan('orders', legal)).toBe(true);
    expect(dedicatedSearchRan('motions', legal)).toBe(true);
    expect(dedicatedSearchRan('depositions', legal)).toBe(true);
    expect(dedicatedSearchRan('expert_testimony', legal)).toBe(true);
    expect(dedicatedSearchRan('university_accreditation', legal)).toBe(true);
  });

  it('does not treat the expert website as independently verified credentials', async () => {
    const result = await provider(
      'expert_website',
      dossier(
        [
          record({
            id: 'site',
            url: 'https://ellenbergneuropsychology.com/about',
            kind: 'expert_website',
            title: 'Leah Ellenberg, PhD',
            summary: 'Board certified clinical neuropsychologist.',
            match: {
              level: 'strong',
              confidence: 'high',
              basis: ['name', 'specialty'],
              conflicts: [],
              quote: 'board certified',
              quoteVerified: true,
              classifiedBy: 'rules',
            },
          }),
        ],
        { topics: [{ topic: 'identity', queries: 1, hits: 1 }] },
      ),
    ).search(query);
    expect(result.items[0].informationStatus).toBe('unverified');
  });
});
