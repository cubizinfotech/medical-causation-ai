import { researchOutcomeFor } from '../providers/research-outcome';
import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import { applyIdentityMatch } from '../providers/identity-match';
import { OrcidClient, parseOrcidId } from './orcid.client';
import { OrcidResearchProvider } from './orcid.provider';
import { fakeFetch, type FakeRoute } from './testing/live-fakes';

const definition = EXPERT_RESEARCH_CATALOG.find(
  (entry) => entry.id === 'orcid',
);

const ORCID = '0000-0002-1825-0097';
const OTHER = '0000-0001-2345-6789';

const TOKEN: FakeRoute = {
  match: (url) => url.pathname === '/oauth/token',
  respond: () => ({ access_token: 'pub-token', expires_in: 631138518 }),
};

function searchRoute(
  hits: unknown[],
  q?: (query: string) => boolean,
): FakeRoute {
  return {
    match: (url) => url.pathname.includes('/expanded-search'),
    respond: (url) => {
      const query = url.searchParams.get('q') ?? '';
      if (q && !q(query)) return { 'num-found': 0, 'expanded-result': [] };
      return { 'num-found': hits.length, 'expanded-result': hits };
    },
  };
}

function recordRoute(orcid: string, body: unknown): FakeRoute {
  return {
    match: (url) => url.pathname.endsWith(`/${orcid}/record`),
    respond: () => body,
  };
}

function hit(
  orcid: string,
  given: string,
  family: string,
  institutions: string[],
) {
  return {
    'orcid-id': orcid,
    'given-names': given,
    'family-names': family,
    'institution-name': institutions,
  };
}

function record(
  orcid: string,
  options: {
    given?: string;
    family?: string;
    employments?: string[];
    keywords?: string[];
    works?: Array<{
      title: string;
      doi?: string;
      pmid?: string;
      year?: string;
      authors?: string[];
    }>;
  },
) {
  return {
    'orcid-identifier': { path: orcid },
    person: {
      name: {
        'given-names': { value: options.given ?? 'Jason' },
        'family-name': { value: options.family ?? 'Demery' },
      },
      keywords: {
        keyword: (options.keywords ?? []).map((content) => ({ content })),
      },
    },
    'activities-summary': {
      employments: {
        'affiliation-group': (options.employments ?? []).map((name) => ({
          summaries: [{ 'employment-summary': { organization: { name } } }],
        })),
      },
      educations: { 'affiliation-group': [] },
      works: {
        group: (options.works ?? []).map((work) => ({
          'work-summary': [
            {
              title: { title: { value: work.title } },
              type: 'journal-article',
              'publication-date': work.year
                ? { year: { value: work.year } }
                : undefined,
              'external-ids': {
                'external-id': [
                  work.doi
                    ? {
                        'external-id-type': 'doi',
                        'external-id-value': work.doi,
                      }
                    : null,
                  work.pmid
                    ? {
                        'external-id-type': 'pmid',
                        'external-id-value': work.pmid,
                      }
                    : null,
                ].filter(Boolean),
              },
              contributors: work.authors
                ? {
                    contributor: work.authors.map((name) => ({
                      'credit-name': { value: name },
                    })),
                  }
                : undefined,
            },
          ],
        })),
      },
    },
  };
}

function makeProvider(
  routes: FakeRoute[],
  creds?: { clientId?: string; clientSecret?: string },
) {
  if (!definition) throw new Error('orcid catalog missing');
  const fake = fakeFetch([TOKEN, ...routes]);
  const provider = new OrcidResearchProvider(
    definition,
    new OrcidClient({
      timeoutMs: 1000,
      fetchImpl: fake.fetch,
      clientId: creds?.clientId ?? 'APP-TEST',
      clientSecret: creds?.clientSecret ?? 'secret',
    }),
  );
  return { provider, calls: fake.calls };
}

const query = {
  expertName: 'Jason A. Demery',
  city: 'Gainesville, FL',
  specialty: 'Neuropsychology',
};

describe('parseOrcidId', () => {
  it('reads a hyphenated iD from a URL or note', () => {
    expect(parseOrcidId(`See https://orcid.org/${ORCID}`)).toBe(ORCID);
    expect(parseOrcidId('no id here')).toBeNull();
  });
});

describe('OrcidResearchProvider', () => {
  it('reports not_configured without sending a request when credentials are missing', async () => {
    const { provider, calls } = makeProvider([], {
      clientId: '',
      clientSecret: '',
    });
    const result = await provider.search(query);
    expect(result.status).toBe('unavailable');
    expect(
      researchOutcomeFor({
        status: result.status,
        access: result.access,
        message: result.message,
        itemCount: result.items.length,
      }),
    ).toBe('not_configured');
    expect(result.items).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('attributes a corroborated profile and lists public works without claiming authorship', async () => {
    const { provider } = makeProvider([
      searchRoute([hit(ORCID, 'Jason', 'Demery', ['University of Florida'])]),
      recordRoute(
        ORCID,
        record(ORCID, {
          employments: ['University of Florida'],
          keywords: ['neuropsychology'],
          works: [
            {
              title: 'Memory after mild TBI',
              doi: '10.1000/tbi',
              pmid: '12345678',
              year: '2018',
            },
          ],
        }),
      ),
    ]);
    const result = await provider.search(query);
    expect(result.status).toBe('ok');
    expect(result.outcome).toBe('success');
    const matched = applyIdentityMatch(query, result.items);
    const profile = matched.find((item) => item.category === 'identity');
    const work = matched.find((item) => item.category === 'publication');
    expect(profile?.identityMatch).toBe('matched');
    expect(profile?.url).toBe(`https://orcid.org/${ORCID}`);
    expect(work?.raw?.doi).toBe('10.1000/tbi');
    expect(work?.raw?.pmid).toBe('12345678');
    expect(work?.summary).toMatch(/not independent proof of authorship/i);
    expect(work?.raw?.authorListIncomplete).toBe(true);
  });

  it('keeps same-name profiles as candidates and does not merge their works', async () => {
    const { provider } = makeProvider([
      searchRoute([
        hit(ORCID, 'Jason', 'Demery', ['Demery Roofing']),
        hit(OTHER, 'Jason', 'Demery', ['Dallas Cardiology']),
      ]),
      recordRoute(ORCID, record(ORCID, { employments: ['Demery Roofing'] })),
      recordRoute(
        OTHER,
        record(OTHER, {
          employments: ['Dallas Cardiology'],
          works: [{ title: 'Shingles and roofs', doi: '10.1000/roof' }],
        }),
      ),
    ]);
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: '',
      specialty: 'Neuropsychology',
    });
    expect(result.outcome).toBe('conflicting');
    expect(result.items.every((item) => item.category === 'identity')).toBe(
      true,
    );
    expect(result.items.some((item) => item.raw?.doi)).toBe(false);
    const matched = applyIdentityMatch(
      { expertName: 'Jason Demery', city: '', specialty: 'Neuropsychology' },
      result.items,
    );
    expect(matched.every((item) => item.identityMatch === 'uncertain')).toBe(
      true,
    );
  });

  it('rejects a weak name match that is a different person', async () => {
    const { provider } = makeProvider([
      searchRoute([hit(ORCID, 'Joan', 'Demery', ['University of Florida'])]),
      recordRoute(
        ORCID,
        record(ORCID, {
          given: 'Joan',
          family: 'Demery',
          employments: ['University of Florida'],
        }),
      ),
    ]);
    const result = await provider.search(query);
    expect(result.status).toBe('no_result');
    expect(result.items).toEqual([]);
    expect(result.message).toMatch(/none of the public names matched/i);
  });

  it('treats an empty completed search as no_result, not as proof of absence', async () => {
    const { provider } = makeProvider([searchRoute([])]);
    const result = await provider.search(query);
    expect(result.status).toBe('no_result');
    expect(result.outcome).toBe('no_result');
    expect(result.message).toMatch(/not proof/i);
  });

  it('uses a supplied ORCID iD when the public name still matches', async () => {
    const { provider, calls } = makeProvider([
      searchRoute([hit(ORCID, 'Jason', 'Demery', [])], (q) =>
        q.includes(`orcid:${ORCID}`),
      ),
      recordRoute(ORCID, record(ORCID, { employments: [] })),
    ]);
    const result = await provider.search({
      ...query,
      context: `ORCID ${ORCID}`,
    });
    expect(result.status).toBe('ok');
    expect(result.items[0]?.raw?.orcid).toBe(ORCID);
    expect(
      calls.some((call) => call.url.searchParams.get('q')?.includes(ORCID)),
    ).toBe(true);
  });

  it('surfaces HTTP 429 as a rate limit and HTTP 500 as a failed lookup', async () => {
    const limited = makeProvider([
      {
        match: (url) => url.pathname.includes('/expanded-search'),
        respond: () => ({ error: 'slow down' }),
        status: 429,
      },
    ]);
    const limitedResult = await limited.provider.search(query);
    expect(limitedResult.status).toBe('error');
    expect(limitedResult.outcome).toBe('rate_limited');

    const failed = makeProvider([
      {
        match: (url) => url.pathname.includes('/expanded-search'),
        respond: () => ({ error: 'down' }),
        status: 500,
      },
    ]);
    const failedResult = await failed.provider.search(query);
    expect(failedResult.status).toBe('error');
    expect(failedResult.outcome).toBe('api_failure');
  });

  it('lists contributor names when ORCID provides them and still marks them unverified', async () => {
    const { provider } = makeProvider([
      searchRoute([hit(ORCID, 'Jason', 'Demery', ['University of Florida'])]),
      recordRoute(
        ORCID,
        record(ORCID, {
          employments: ['University of Florida'],
          works: [
            {
              title: 'Named contributors paper',
              doi: '10.1000/named',
              authors: ['Jason A. Demery', 'Ann Lee'],
            },
          ],
        }),
      ),
    ]);
    const result = await provider.search(query);
    const work = result.items.find((item) => item.category === 'publication');
    expect(work?.raw?.authors).toEqual(['Jason A. Demery', 'Ann Lee']);
    expect(work?.informationStatus).toBe('unverified');
    expect(work?.raw?.authorListIncomplete).toBe(false);
  });
});
