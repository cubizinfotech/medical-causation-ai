/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion -- test doubles */
import { EXPERT_RESEARCH_CATALOG } from '../expert-research/providers/provider-catalog';
import type { SafeFetcher, FetchedPage } from './safe-fetcher';
import {
  WebResearchEngine,
  canonicalUrl,
  suppliedUrls,
} from './web-research-engine';
import { createWebSourceProviders } from './web-source-providers';
import {
  SearchProviderError,
  type SearchHit,
  type SearchProvider,
  type SearchRequest,
  type WebResearchSettings,
} from './web-research.types';

const settings: WebResearchSettings = {
  providers: [],
  maxQueries: 12,
  maxPages: 20,
  searchTimeoutMs: 1000,
  fetchTimeoutMs: 1000,
  maxFetchPages: 20,
  deadlineMs: 60_000,
};

const SUBJECT_URL = 'https://neuro-clinic.example/about-dr-demery';
const OTHER_URL = 'https://roofing.example/team/jason-b-demery';
const BLOCKED_URL = 'https://protected.example/story-about-demery';
const UNRELATED_URL = 'https://fishing.example/results';

const PAGES: Record<string, FetchedPage> = {
  [SUBJECT_URL]: {
    url: SUBJECT_URL,
    finalUrl: SUBJECT_URL,
    status: 'read',
    note: null,
    title: 'About Dr. Demery',
    description: null,
    publishedAt: '2026-03-01',
    text: 'Dr. Jason A. Demery, PhD is a board certified neuropsychologist in Gainesville, Florida. Dr. Demery evaluates brain injury and serves as a forensic expert witness for attorneys across Florida.',
  },
  [OTHER_URL]: {
    url: OTHER_URL,
    finalUrl: OTHER_URL,
    status: 'read',
    note: null,
    title: 'Our team',
    description: null,
    publishedAt: null,
    text: 'Jason B. Demery is the owner of Demery Roofing in Dallas, TX. Jason B. Demery has installed roofs for residential customers across north Texas for twenty years and offers free estimates.',
  },
  [BLOCKED_URL]: {
    url: BLOCKED_URL,
    finalUrl: BLOCKED_URL,
    status: 'restricted',
    botBlocked: true,
    note: 'The site answered with a bot-protection or CAPTCHA page (HTTP 403). It was not bypassed, so this page’s content was not read.',
  },
  [UNRELATED_URL]: {
    url: UNRELATED_URL,
    finalUrl: UNRELATED_URL,
    status: 'read',
    note: null,
    title: 'Tournament results',
    description: null,
    publishedAt: null,
    text: 'The weekend bass tournament drew forty boats to the lake and the winner landed a fourteen pound fish near the north shore before noon on Saturday afternoon.',
  },
};

function fakeFetcher(): SafeFetcher {
  return {
    fetchPage: async (url: string): Promise<FetchedPage> =>
      PAGES[url] ?? {
        url,
        finalUrl: url,
        status: 'failed',
        note: 'The page could not be reached.',
      },
  } as unknown as SafeFetcher;
}

function hit(
  url: string,
  title: string,
  snippet = '',
): Omit<SearchHit, 'providerId' | 'query' | 'kind'> {
  return { url, title, snippet };
}

function fakeProvider(
  id: string,
  results: Array<Omit<SearchHit, 'providerId' | 'query' | 'kind'>>,
  over: Partial<SearchProvider> = {},
): SearchProvider & { requests: SearchRequest[] } {
  const requests: SearchRequest[] = [];
  return {
    id,
    name: `Fake ${id}`,
    kinds: ['web', 'news'],
    budget: 40,
    concurrency: 2,
    isConfigured: () => true,
    requests,
    async search(request) {
      requests.push(request);
      return results.map((item) => ({
        ...item,
        providerId: id,
        query: request.query,
        kind: request.kind,
      }));
    },
    ...over,
  };
}

const query = {
  expertName: 'Jason A. Demery',
  city: 'Gainesville, FL',
  specialty: 'Neuropsychology',
};

const allHits = [
  hit(SUBJECT_URL, 'About Dr. Demery', 'Dr. Jason A. Demery neuropsychologist'),
  hit(OTHER_URL, 'Our team', 'Jason B. Demery owner Demery Roofing'),
  hit(
    BLOCKED_URL,
    'Story about Jason Demery',
    'Jason Demery testified in court',
  ),
  hit(UNRELATED_URL, 'Tournament results', 'bass tournament results'),
];

describe('canonicalUrl', () => {
  it('drops tracking parameters, fragments, www and trailing slashes', () => {
    expect(
      canonicalUrl('https://www.Example.com/a?utm_source=x&id=2#top'),
    ).toBe('https://example.com/a?id=2');
    expect(canonicalUrl('https://www.example.com/a/')).toBe(
      'https://example.com/a',
    );
  });
});

describe('WebResearchEngine', () => {
  it('separates the expert from a same-name person and never merges them', async () => {
    const provider = fakeProvider('fake_search', allHits);
    const engine = new WebResearchEngine({
      settings,
      providers: [provider],
      fetcher: fakeFetcher(),
    });
    const dossier = await engine.run(query);

    const subject = dossier.candidates.find(
      (candidate) => candidate.role === 'subject',
    );
    const others = dossier.candidates.filter(
      (candidate) => candidate.role === 'other',
    );
    const byUrl = (url: string) =>
      dossier.records.find((record) => record.url === url);

    expect(subject).toBeDefined();
    expect(subject?.recordIds).toContain(byUrl(SUBJECT_URL)?.id);
    expect(subject?.recordIds).not.toContain(byUrl(OTHER_URL)?.id);
    expect(
      others.some((candidate) =>
        candidate.recordIds.includes(byUrl(OTHER_URL)?.id ?? ''),
      ),
    ).toBe(true);
    expect(byUrl(SUBJECT_URL)?.match.level).toMatch(/strong|possible/);
    expect(byUrl(OTHER_URL)?.match.level).not.toMatch(/strong|possible/);
    expect(byUrl(OTHER_URL)?.candidateId).not.toBe(subject?.id);
    // A page that never names the person is not kept.
    expect(byUrl(UNRELATED_URL)).toBeUndefined();
  });

  it('lists a bot-blocked page by address and says it was not read', async () => {
    const engine = new WebResearchEngine({
      settings,
      providers: [fakeProvider('fake_search', allHits)],
      fetcher: fakeFetcher(),
    });
    const dossier = await engine.run(query);
    expect(dossier.pagesBlocked.map((page) => page.url)).toContain(BLOCKED_URL);
    expect(dossier.pagesBlocked[0].reason).toMatch(/not bypassed/);
    expect(dossier.limitations.join(' ')).toMatch(/could not be read/);
    const blocked = dossier.records.find(
      (record) => record.url === BLOCKED_URL,
    );
    expect(
      blocked?.read === 'restricted' || blocked?.read === 'snippet_only',
    ).toBe(true);
    expect(blocked?.match.level).not.toBe('strong');
  });

  it('requests page 2 from Serper when page 1 returned hits', async () => {
    const serper = fakeProvider('serper', allHits, { budget: 80 });
    const dossier = await new WebResearchEngine({
      settings: { ...settings, maxQueries: 8 },
      providers: [serper],
      fetcher: fakeFetcher(),
    }).run(query);
    const pages = serper.requests.map((request) => request.page ?? 1);
    expect(pages).toContain(2);
    expect(dossier.queriesRun).toBeGreaterThan(serper.requests.filter((r) => (r.page ?? 1) === 1).length);
  });

  it('sends patent, IME and directory queries when the budget cannot run every search', async () => {
    const provider = fakeProvider('fake_search', allHits, { budget: 35 });
    await new WebResearchEngine({
      settings: { ...settings, maxQueries: 35 },
      providers: [provider],
      fetcher: fakeFetcher(),
    }).run(query);
    const queries = provider.requests.map((request) => request.query).join('\n');
    expect(queries).toMatch(/site:patents\.google\.com/);
    expect(queries).toMatch(/independent medical examination/);
    expect(queries).toMatch(/site:dri\.org/);
    expect(queries).toMatch(/site:expertinstitute\.com/);
  });

  it('records omitted topics when the query budget is smaller than the plan', async () => {
    const provider = fakeProvider('fake_search', allHits, { budget: 8 });
    const dossier = await new WebResearchEngine({
      settings: { ...settings, maxQueries: 8 },
      providers: [provider],
      fetcher: fakeFetcher(),
    }).run(query);
    expect(dossier.omittedTopics?.length).toBeGreaterThan(0);
    expect(dossier.limitations.join(' ')).toMatch(
      /query budget or time limit was reached/i,
    );
  });

  it('stops calling Serper after a credit failure, including news-lead resolution', async () => {
    let serperCalls = 0;
    const serper = fakeProvider('serper', [], {
      concurrency: 4,
      budget: 80,
      kinds: ['web', 'news', 'places', 'scholar'],
      async search() {
        serperCalls += 1;
        throw new SearchProviderError(
          'The search service reports no remaining credit (HTTP 400).',
          'quota',
          400,
        );
      },
    });
    const gemini = fakeProvider('gemini_grounding', [
      hit(
        'https://news.google.com/articles/abc',
        'Demery testified',
        'Published by Court TV.',
      ),
      ...allHits,
    ]);
    const dossier = await new WebResearchEngine({
      settings: { ...settings, maxQueries: 20 },
      providers: [serper, gemini],
      fetcher: fakeFetcher(),
    }).run(query);
    expect(serperCalls).toBeLessThanOrEqual(4);
    expect(
      dossier.providers.find((provider) => provider.providerId === 'serper')
        ?.failures[0]?.kind,
    ).toBe('quota');
  });

  it('records a failing provider and does not claim the web was searched', async () => {
    const failing = fakeProvider('broken', [], {
      async search() {
        throw new SearchProviderError('Quota exceeded', 'quota');
      },
    });
    const dossier = await new WebResearchEngine({
      settings,
      providers: [failing],
      fetcher: fakeFetcher(),
    }).run(query);
    expect(dossier.records).toHaveLength(0);
    expect(dossier.partial).toBe(true);
    expect(dossier.providers[0].failures[0].message).toMatch(/Quota exceeded/);
    expect(dossier.limitations.join(' ')).toMatch(/failed/);
    expect(dossier.limitations.join(' ')).toMatch(
      /does not prove|cannot prove|not found in what/i,
    );
  });

  it('says so when no provider is configured', async () => {
    const dossier = await new WebResearchEngine({
      settings,
      providers: [fakeProvider('off', allHits, { isConfigured: () => false })],
      fetcher: fakeFetcher(),
    }).run(query);
    expect(dossier.queriesRun).toBe(0);
    expect(dossier.limitations.join(' ')).toMatch(
      /No web search provider is configured/,
    );
    expect(dossier.providers[0].configured).toBe(false);
  });

  it('runs without a city and puts no place text in the queries', async () => {
    const provider = fakeProvider('fake_search', allHits);
    const dossier = await new WebResearchEngine({
      settings,
      providers: [provider],
      fetcher: fakeFetcher(),
    }).run({ ...query, city: '' });
    expect(dossier.queriesRun).toBeGreaterThan(0);
    for (const request of provider.requests) {
      expect(request.query).not.toMatch(/undefined|null/);
    }
    expect(dossier.records.length).toBeGreaterThan(0);
  });

  it('uses the additional context to search for names and employers', async () => {
    const provider = fakeProvider('fake_search', allHits);
    await new WebResearchEngine({
      settings,
      providers: [provider],
      fetcher: fakeFetcher(),
    }).run({
      ...query,
      context: 'Formerly at Shands Hospital. Also called Jay Demery.',
    });
    expect(
      provider.requests.some((request) =>
        /Shands|Jay Demery/.test(request.query),
      ),
    ).toBe(true);
  });

  it('reads an address pasted into the additional context and lists it even when it is blocked', async () => {
    const provider = fakeProvider('fake_search', []);
    const dossier = await new WebResearchEngine({
      settings,
      providers: [provider],
      fetcher: fakeFetcher(),
    }).run({
      ...query,
      context: `See ${BLOCKED_URL}. The article ${SUBJECT_URL} is about him.`,
    });
    const blocked = dossier.records.find(
      (record) => record.url === BLOCKED_URL,
    );
    expect(blocked?.match.level).toBe('weak');
    expect(blocked?.match.basis.join(' ')).toMatch(/supplied in the request/);
    expect(dossier.pagesBlocked.map((page) => page.url)).toContain(BLOCKED_URL);
    const read = dossier.records.find((record) => record.url === SUBJECT_URL);
    expect(read?.read).toBe('read');
    expect(read?.searchProviders).toContain('intake_note');
  });

  it('extracts at most five clean addresses from a note', () => {
    expect(
      suppliedUrls(
        'a https://x.example/a, b (https://y.example/b). https://x.example/a',
      ),
    ).toEqual(['https://x.example/a', 'https://y.example/b']);
    expect(suppliedUrls(undefined)).toEqual([]);
  });
  it('refuses to run with a name that cannot be split', async () => {
    const dossier = await new WebResearchEngine({
      settings,
      providers: [fakeProvider('fake_search', allHits)],
      fetcher: fakeFetcher(),
    }).run({ ...query, expertName: 'Demery' });
    expect(dossier.partial).toBe(true);
    expect(dossier.records).toHaveLength(0);
  });

  it('shares one memoized run between callers for the same subject', async () => {
    const provider = fakeProvider('fake_search', allHits);
    const engine = new WebResearchEngine({
      settings,
      providers: [provider],
      fetcher: fakeFetcher(),
    });
    const [first, second] = await Promise.all([
      engine.research(query),
      engine.research(query),
    ]);
    expect(first).toBe(second);
    const after = provider.requests.length;
    await engine.research(query);
    expect(provider.requests.length).toBe(after);
  });

  it('lists social profile addresses named in a grounded search answer', async () => {
    const provider = fakeProvider('fake_search', [
      {
        ...hit(
          SUBJECT_URL,
          'About Dr. Demery',
          'Dr. Jason A. Demery neuropsychologist',
        ),
        answer:
          'Dr. Jason A. Demery is a neuropsychologist. Official work updates are posted on X/Twitter @UFHealth and LinkedIn https://www.linkedin.com/company/uf-health',
      },
    ]);
    const dossier = await new WebResearchEngine({
      settings,
      providers: [provider],
      fetcher: fakeFetcher(),
    }).run(query);
    const urls = dossier.records.map((record) => record.url);
    expect(urls.some((url) => /x\.com\/UFHealth/i.test(url))).toBe(true);
    expect(
      urls.some((url) => /linkedin\.com\/company\/uf-health/i.test(url)),
    ).toBe(true);
    const social = dossier.records.filter((record) => record.kind === 'social');
    expect(social.length).toBeGreaterThan(0);
    expect(social.every((record) => record.match.level !== 'none')).toBe(true);
  });

  it('keeps a public photo from a page about the expert', async () => {
    const photo = 'https://neuro-clinic.example/jason.png';
    const png = Buffer.concat([
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
      Buffer.alloc(5_000, 0),
    ]);
    const fetcher = {
      fetchPage: async (url: string): Promise<FetchedPage> => {
        const page =
          PAGES[url] ??
          ({
            url,
            finalUrl: url,
            status: 'failed',
            note: 'The page could not be reached.',
          } satisfies FetchedPage);
        if (url === SUBJECT_URL && page.status === 'read') {
          return {
            ...page,
            portraits: [{ url: photo, via: 'og' }],
          };
        }
        return page;
      },
      fetchImage: async (url: string) =>
        url === photo
          ? { url, mimeType: 'image/png' as const, bytes: png }
          : null,
    } as unknown as SafeFetcher;
    const dossier = await new WebResearchEngine({
      settings,
      providers: [fakeProvider('fake_search', allHits)],
      fetcher,
    }).run(query);
    expect(dossier.portrait?.sourceUrl).toBe(SUBJECT_URL);
    expect(dossier.portrait?.imageUrl).toBe(photo);
    expect(dossier.portrait?.dataUrl.startsWith('data:image/png;base64,')).toBe(
      true,
    );
    expect(dossier.limitations.join(' ')).not.toMatch(/photograph of this person/);
  });

  it('keeps a faculty headshot whose file name names the expert', async () => {
    const faculty = 'https://med.ufl.edu/faculty/jason-demery';
    const photo = 'https://med.ufl.edu/faculty/demery-headshot.jpg';
    const jpeg = Buffer.alloc(6_000, 1);
    const fetcher = {
      fetchPage: async (url: string): Promise<FetchedPage> => {
        if (url === faculty) {
          return {
            url: faculty,
            finalUrl: faculty,
            status: 'read',
            note: null,
            title: 'Jason A. Demery, Ph.D.',
            description: null,
            publishedAt: null,
            text: 'Dr. Jason A. Demery is a clinical neuropsychologist on the University of Florida faculty in Gainesville.',
            portraits: [{ url: photo, via: 'img', label: 'headshot' }],
          };
        }
        return (
          PAGES[url] ?? {
            url,
            finalUrl: url,
            status: 'failed',
            note: 'The page could not be reached.',
          }
        );
      },
      fetchImage: async (url: string) =>
        url === photo
          ? { url, mimeType: 'image/jpeg' as const, bytes: jpeg }
          : null,
    } as unknown as SafeFetcher;
    const dossier = await new WebResearchEngine({
      settings,
      providers: [
        fakeProvider('fake_search', [
          hit(faculty, 'Jason A. Demery faculty', 'neuropsychologist Gainesville'),
          ...allHits,
        ]),
      ],
      fetcher,
    }).run(query);
    expect(dossier.portrait?.sourceUrl).toBe(faculty);
    expect(dossier.portrait?.imageUrl).toBe(photo);
  });
});

describe('web catalog sources', () => {
  const definitions = EXPERT_RESEARCH_CATALOG.filter((item) =>
    ['web_search', 'news', 'social'].includes(item.id),
  );

  it('answers catalog sources from the shared run and keeps the other person out', async () => {
    const engine = new WebResearchEngine({
      settings,
      providers: [fakeProvider('fake_search', allHits)],
      fetcher: fakeFetcher(),
    });
    const providers = createWebSourceProviders(definitions, engine);
    const web = await providers.get('web_search' as never)?.search(query);
    expect(['ok', 'no_result']).toContain(web?.status);
    expect(
      web?.items.some((item) => item.title === 'Web research coverage'),
    ).toBe(false);
    expect(web?.message ?? '').toMatch(/Searched|matched|pages/i);
    const attributed = web?.items.filter(
      (item) =>
        (item.raw as { identity?: { ambiguous?: boolean } })?.identity
          ?.ambiguous === false,
    );
    expect(attributed?.some((item) => item.url === OTHER_URL)).toBe(false);
  });

  it('records a completed search with no pages as no_result, not success', async () => {
    const engine = new WebResearchEngine({
      settings,
      providers: [fakeProvider('empty_search', [])],
      fetcher: fakeFetcher(),
    });
    const web = await createWebSourceProviders(definitions, engine)
      .get('web_search' as never)
      ?.search(query);
    expect(web?.status).toBe('no_result');
    expect(web?.outcome).toBe('no_result');
    expect(web?.message).toMatch(/Searched/);
    expect(web?.message).toMatch(/cannot prove that none exist/);
    expect(web?.items.some((item) => item.url && item.url.length > 0)).toBe(
      false,
    );
  });

  it('reports unavailable, not "none found", when nothing could be searched', async () => {
    const engine = new WebResearchEngine({
      settings,
      providers: [fakeProvider('off', allHits, { isConfigured: () => false })],
      fetcher: fakeFetcher(),
    });
    const news = await createWebSourceProviders(definitions, engine)
      .get('news' as never)
      ?.search(query);
    expect(news?.status).toBe('unavailable');
    expect(news?.outcome).toBe('not_configured');
    expect(news?.message).toMatch(/Not searched/);
    expect(news?.message).toMatch(/not a finding/);
  });
});
