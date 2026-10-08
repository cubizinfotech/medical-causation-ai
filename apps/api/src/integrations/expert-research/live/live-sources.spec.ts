import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import type {
  ExpertResearchProviderId,
  ExpertResearchQuery,
} from '../expert-research.types';
import { excerptsAround, detectStandard } from './courtlistener.provider';
import { createLiveSourceProviders } from './live-sources';
import {
  fakeFetch,
  nppesRoute,
  type FakeRoute,
  type NppesFixture,
} from './testing/live-fakes';

const doctor: NppesFixture = {
  npi: '1234567893',
  first: 'Jane',
  middle: 'Ann',
  last: 'Smith',
  city: 'Phoenix',
  state: 'AZ',
  taxonomy: 'Psychiatry & Neurology, Neurology',
};

const query: ExpertResearchQuery = {
  expertName: 'Jane Smith',
  city: 'Phoenix',
  specialty: 'Neurology',
};

function providers(routes: FakeRoute[], token?: string) {
  const fake = fakeFetch(routes);
  const map = createLiveSourceProviders(EXPERT_RESEARCH_CATALOG, {
    timeoutMs: 1000,
    fetchImpl: fake.fetch,
    courtListenerToken: token,
    openPaymentsYears: 2,
  });
  const get = (id: ExpertResearchProviderId) => {
    const provider = map.get(id);
    if (!provider) throw new Error(`missing ${id}`);
    return provider;
  };
  return { get, calls: fake.calls };
}

const paymentsRoutes: FakeRoute[] = [
  {
    match: (url) => url.pathname.endsWith('/metastore/schemas/dataset/items'),
    respond: () => [
      { identifier: 'ds-2023', title: '2023 General Payment Data' },
      { identifier: 'ds-2024', title: '2024 General Payment Data' },
      { identifier: 'ds-2022', title: '2022 General Payment Data' },
      { identifier: 'r-2024', title: '2024 Research Payment Data' },
    ],
  },
  {
    match: (url) => url.pathname.includes('/datastore/query/ds-2024/'),
    respond: () => ({
      count: 2,
      results: [
        {
          applicable_manufacturer_or_applicable_gpo_making_payment_name:
            'Acme Devices',
          nature_of_payment_or_transfer_of_value: 'Consulting Fee',
          covered_recipient_profile_id: '718136',
          covered_recipient_type: 'Covered Recipient Physician',
          total: '1000.10',
          records: '2',
        },
        {
          applicable_manufacturer_or_applicable_gpo_making_payment_name:
            'Beta Pharma',
          nature_of_payment_or_transfer_of_value: 'Food and Beverage',
          covered_recipient_profile_id: '718136',
          covered_recipient_type: 'Covered Recipient Physician',
          total: '20.20',
          records: '3',
        },
      ],
    }),
  },
  {
    match: (url) => url.pathname.includes('/datastore/query/ds-2023/'),
    respond: () => ({
      count: 1,
      results: [
        {
          // Same company, different spelling in another year.
          applicable_manufacturer_or_applicable_gpo_making_payment_name:
            'ACME DEVICES',
          nature_of_payment_or_transfer_of_value: 'Consulting Fee',
          covered_recipient_profile_id: '718136',
          covered_recipient_type: 'Covered Recipient Physician',
          total: '0.30',
          records: '1',
        },
      ],
    }),
  },
];

describe('Open Payments live source', () => {
  it('totals exact cents per year and company for the confirmed NPI', async () => {
    const { get, calls } = providers([nppesRoute([doctor]), ...paymentsRoutes]);
    const result = await get('open_payments').search(query);
    expect(result.status).toBe('ok');
    const [summary, acme, beta] = result.items;
    expect(summary.title).toBe(
      'CMS Open Payments 2023–2024: $1,020.60 from 2 companies',
    );
    expect(summary.raw).toMatchObject({
      totalAmount: 1020.6,
      recordCount: 6,
      payerCount: 2,
      byYear: [
        { year: 2024, total: 1020.3, records: 5 },
        { year: 2023, total: 0.3, records: 1 },
      ],
      identity: { verifiedBy: 'npi', npi: '1234567893' },
    });
    expect(summary.url).toBe(
      'https://openpaymentsdata.cms.gov/physician/718136',
    );
    expect(acme.title).toBe(
      'Open Payments: Acme Devices — $1,000.40 (2023–2024)',
    );
    expect(beta.raw?.natureOfPayment).toBe('Food and Beverage $20.20 (3)');
    // Only the two newest general-payment datasets, filtered by NPI.
    const queries = calls.filter((call) =>
      call.url.pathname.includes('/datastore/query/'),
    );
    expect(
      queries.map((call) => call.url.pathname.split('/')[5]).sort(),
    ).toEqual(['ds-2023', 'ds-2024']);
    expect(queries[0].body).toMatchObject({
      conditions: [
        {
          property: 'covered_recipient_npi',
          value: '1234567893',
          operator: '=',
        },
      ],
    });
  });

  it('does not search payments without a confirmed NPI', async () => {
    const { get, calls } = providers([
      nppesRoute([doctor, { ...doctor, npi: '1457767758', middle: 'B' }]),
      ...paymentsRoutes,
    ]);
    const result = await get('open_payments').search(query);
    expect(result.status).toBe('unavailable');
    expect(result.items).toHaveLength(0);
    expect(result.message).toMatch(/only by a confirmed NPI/);
    expect(
      calls.some((call) => call.url.host.includes('openpaymentsdata')),
    ).toBe(false);
  });
});

describe('NPI Registry live source', () => {
  it('returns identity and self-reported licenses for a confirmed NPI', async () => {
    const { get } = providers([
      nppesRoute([{ ...doctor, license: { state: 'AZ', number: '12345' } }]),
    ]);
    const result = await get('npi_registry').search(query);
    expect(result.identity?.status).toBe('confirmed');
    expect(result.items.map((item) => item.category)).toEqual([
      'identity',
      'license',
    ]);
    expect(result.items[0].informationStatus).toBe('verified');
    expect(result.items[1].informationStatus).toBe('unverified');
    expect(result.items[1].summary).toMatch(/does not verify them/);
    // Licenses are not stored under keys the CV comparison reads as records.
    expect(result.items[1].raw).not.toHaveProperty('state');
    expect(result.items[1].raw?.nppesLicenses).toEqual([
      {
        state: 'AZ',
        number: '12345',
        taxonomy: doctor.taxonomy,
        primary: true,
      },
    ]);
  });

  it('reports an ambiguous identity with candidates and no items', async () => {
    const { get } = providers([
      nppesRoute([doctor, { ...doctor, npi: '1457767758', middle: 'B' }]),
    ]);
    const result = await get('npi_registry').search(query);
    expect(result.items).toHaveLength(0);
    expect(result.identity?.status).toBe('ambiguous');
    expect(result.identity?.candidates).toHaveLength(2);
  });
});

function openAlexRoutes(
  authors: unknown[],
  institutions: unknown[],
): FakeRoute[] {
  return [
    {
      match: (url) =>
        url.host === 'api.openalex.org' && url.pathname === '/authors',
      respond: () => ({ results: authors, meta: { count: authors.length } }),
    },
    {
      match: (url) =>
        url.host === 'api.openalex.org' && url.pathname === '/institutions',
      respond: () => ({ results: institutions }),
    },
    {
      match: (url) =>
        url.host === 'api.openalex.org' &&
        url.pathname === '/works' &&
        (url.searchParams.get('filter') ?? '').includes('is_retracted:true'),
      respond: () => ({
        meta: { count: 1 },
        results: [
          {
            id: 'https://openalex.org/W2',
            title: 'Withdrawn study',
            publication_year: 2015,
            is_retracted: true,
            authorships: [
              {
                author_position: 'first',
                author: {
                  id: 'https://openalex.org/A1',
                  display_name: 'Jane Smith',
                },
              },
            ],
          },
        ],
      }),
    },
    {
      match: (url) =>
        url.host === 'api.openalex.org' && url.pathname === '/works',
      respond: () => ({
        meta: { count: 1 },
        results: [
          {
            id: 'https://openalex.org/W1',
            doi: 'https://doi.org/10.1/x',
            title: 'Migraine outcomes',
            publication_year: 2020,
            publication_date: '2020-05-01',
            primary_location: { source: { display_name: 'Neurology' } },
            cited_by_count: 12,
            is_retracted: false,
            authorships: [
              {
                author_position: 'first',
                author: {
                  id: 'https://openalex.org/A9',
                  display_name: 'Ann Lee',
                },
              },
              {
                author_position: 'last',
                author: {
                  id: 'https://openalex.org/A1',
                  display_name: 'Jane Smith',
                },
              },
            ],
          },
        ],
      }),
    },
  ];
}

const neuroTopics = [
  {
    display_name: 'Migraine and Headache Studies',
    subfield: { display_name: 'Neurology' },
    field: { display_name: 'Medicine' },
  },
];

describe('OpenAlex live source', () => {
  it('uses the one profile whose topics and institution fit', async () => {
    const { get } = providers([
      nppesRoute([doctor]),
      ...openAlexRoutes(
        [
          {
            id: 'https://openalex.org/A1',
            display_name: 'Jane A. Smith',
            works_count: 40,
            topics: neuroTopics,
            affiliations: [{ institution: { id: 'https://openalex.org/I1' } }],
          },
          {
            id: 'https://openalex.org/A2',
            display_name: 'Jane Smith',
            works_count: 300,
            topics: [
              {
                display_name: 'Galaxy formation',
                subfield: { display_name: 'Astronomy' },
              },
            ],
            affiliations: [{ institution: { id: 'https://openalex.org/I1' } }],
          },
          {
            id: 'https://openalex.org/A3',
            display_name: 'Jane Smith',
            topics: neuroTopics,
            affiliations: [{ institution: { id: 'https://openalex.org/I2' } }],
          },
        ],
        [
          {
            id: 'https://openalex.org/I1',
            display_name: 'Barrow Neurological Institute',
            geo: { city: 'Phoenix', region: 'Arizona', country_code: 'US' },
          },
          {
            id: 'https://openalex.org/I2',
            display_name: 'Oxford',
            geo: { city: 'Oxford', region: 'England', country_code: 'GB' },
          },
        ],
      ),
    ]);
    const result = await get('openalex').search(query);
    expect(result.status).toBe('ok');
    const [profile, retracted, work] = result.items;
    expect(profile.title).toBe('OpenAlex author profile: Jane A. Smith');
    expect(profile.raw?.identity).toMatchObject({ verifiedBy: 'source_match' });
    expect(retracted.title).toBe('RETRACTED: Withdrawn study');
    expect(retracted.raw?.retractionStatus).toBe('Retracted (OpenAlex)');
    expect(work.raw).toMatchObject({
      authorPosition: 'last',
      authorship: 'Last (senior) author',
      journal: 'Neurology',
    });
  });

  it('attributes nothing when two profiles fit', async () => {
    const author = (id: string) => ({
      id,
      display_name: 'Jane Smith',
      topics: neuroTopics,
      affiliations: [{ institution: { id: 'https://openalex.org/I1' } }],
    });
    const { get } = providers([
      nppesRoute([doctor]),
      ...openAlexRoutes(
        [author('https://openalex.org/A1'), author('https://openalex.org/A4')],
        [
          {
            id: 'https://openalex.org/I1',
            display_name: 'Barrow',
            geo: { city: 'Phoenix', region: 'Arizona', country_code: 'US' },
          },
        ],
      ),
    ]);
    const result = await get('openalex').search(query);
    expect(result.items).toHaveLength(0);
    expect(result.outcome).toBe('conflicting');
    expect(result.message).toMatch(/could not be told apart/);
  });
});

describe('CourtListener live source', () => {
  const hit = (cluster: number, snippet: string) => ({
    absolute_url: `/opinion/${cluster}/case/`,
    caseName: `Doe v. Roe ${cluster}`,
    cluster_id: cluster,
    court: 'District Court, D. Arizona',
    dateFiled: '2019-03-04',
    docketNumber: '2:18-cv-1',
    citation: ['2019 WL 1'],
    opinions: [{ id: cluster * 10, snippet }],
  });

  function courtRoutes(): FakeRoute[] {
    return [
      nppesRoute([doctor]),
      {
        match: (url) => url.pathname === '/api/rest/v4/search/',
        respond: (url) =>
          (url.searchParams.get('q') ?? '').includes('Daubert')
            ? {
                count: 1,
                results: [
                  hit(
                    1,
                    'the <mark>motion to exclude</mark> Dr. Smith is granted',
                  ),
                ],
              }
            : {
                count: 2,
                results: [
                  hit(
                    1,
                    'Plaintiff retained Dr. <mark>Jane Smith</mark>, a neurologist',
                  ),
                  hit(2, 'Dr. Jane Smith, a neurologist, testified'),
                ],
              },
      },
      {
        match: (url) => url.pathname === '/api/rest/v4/opinions/10/',
        respond: () => ({
          plain_text:
            'Background facts. Plaintiff offers Dr. Jane Smith, a neurologist. Defendant moves to exclude her causation opinion under Daubert. The motion to exclude Dr. Smith is GRANTED. Other matters follow.',
        }),
      },
    ];
  }

  it('searches the full name with specialty terms and flags challenges', async () => {
    const { get, calls } = providers(courtRoutes());
    const result = await get('courtlistener').search(query);
    expect(result.items).toHaveLength(2);
    const queries = calls
      .filter((call) => call.url.pathname === '/api/rest/v4/search/')
      .map((call) => call.url.searchParams.get('q') ?? '');
    expect(queries[0]).toContain(
      '("Jane Smith" OR "Jane A. Smith" OR "Jane Ann Smith") AND (neurolog*)',
    );
    expect(queries[0]).toContain('Daubert OR Frye OR "Rule 702"');
    const [challenge, mention] = result.items;
    expect(challenge.raw).toMatchObject({
      documentType: 'expert_witness_case',
      challenge: {
        outcome: 'not_determined',
        excerptSource: 'search_snippet',
        excerpts: [
          'the motion to exclude Dr. Smith is granted',
          'Plaintiff retained Dr. Jane Smith, a neurologist',
        ],
      },
    });
    expect(mention.raw?.documentType).toBe('case');
    expect(mention.raw).not.toHaveProperty('challenge');
    expect(result.message).toMatch(/no CourtListener API token/);
  });

  it('reads opinion text around the surname when a token is set', async () => {
    const { get, calls } = providers(courtRoutes(), 'secret-token');
    const result = await get('courtlistener').search(query);
    const challenge = result.items[0].raw?.challenge as {
      excerpts: string[];
      excerptSource: string;
      standard: string;
    };
    expect(challenge.excerptSource).toBe('opinion_text');
    expect(challenge.standard).toBe('daubert');
    expect(challenge.excerpts[0]).toContain(
      'The motion to exclude Dr. Smith is GRANTED.',
    );
    const opinionCall = calls.find((call) =>
      call.url.pathname.includes('/opinions/'),
    );
    expect(opinionCall).toBeDefined();
  });
});

describe('court opinion helpers', () => {
  it('detects the admissibility standard', () => {
    expect(detectStandard('motion under Daubert v. Merrell Dow')).toBe(
      'daubert',
    );
    expect(detectStandard('the Frye general acceptance test')).toBe('frye');
    expect(detectStandard('Federal Rule of Evidence: Rule 702')).toBe(
      'rule_702',
    );
    expect(detectStandard('motion in limine')).toBe('unspecified');
  });

  it('keeps verbatim windows around the surname, preferring ruling language', () => {
    const filler = 'word '.repeat(200);
    const text = `${filler}Smith was retained.${filler}The motion to exclude Smith is granted.${filler}`;
    const windows = excerptsAround(text, 'smith', 60, 1);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toContain('The motion to exclude Smith is granted.');
    expect(text.replace(/\s+/g, ' ')).toContain(windows[0]);
  });
});
