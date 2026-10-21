import { CrossrefClient } from './crossref.client';
import { OpenAlexClient } from './openalex.client';
import { OrcidClient } from './orcid.client';
import {
  articleTitle,
  PublicationTitleLookup,
  sameTitle,
} from './publication-lookup';
import { fakeFetch } from './testing/live-fakes';

describe('publication title lookup', () => {
  it('pulls the article title out of a CV citation', () => {
    expect(
      articleTitle(
        'Hanlon, R.E., Demery, J.A. (1998). Axial movements are relatively preserved. Cortex, 34, 731-741.',
      ),
    ).toBe('Axial movements are relatively preserved');
    expect(articleTitle('Domestic homicide profiles')).toBe(
      'Domestic homicide profiles',
    );
  });

  it('treats small differences in a title as the same title', () => {
    expect(
      sameTitle(
        'Migraine Outcomes After Cervical Fusion: A Cohort Study',
        'Migraine outcomes after cervical fusion',
      ),
    ).toBe(true);
    expect(
      sameTitle(
        'Migraine outcomes after cervical fusion',
        'Stroke outcomes after carotid stenting',
      ),
    ).toBe(false);
  });

  it('tells authored, not-authored, and missing titles apart', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.pathname === '/works',
        respond: (url) => {
          const search = url.searchParams.get('search') ?? '';
          if (search.startsWith('Migraine')) {
            return {
              results: [
                {
                  id: 'https://openalex.org/W1',
                  doi: 'https://doi.org/10.1/m',
                  title: 'Migraine outcomes after cervical fusion',
                  publication_year: 2015,
                  authorships: [
                    { author: { display_name: 'Jane A. Smith' } },
                    { author: { display_name: 'Ann Lee' } },
                  ],
                },
              ],
            };
          }
          if (search.startsWith('Spine')) {
            return {
              results: [
                {
                  id: 'https://openalex.org/W2',
                  title: 'Spine study of lumbar fusion rates',
                  publication_year: 2012,
                  authorships: [{ author: { display_name: 'Bo Chen' } }],
                },
              ],
            };
          }
          return { results: [] };
        },
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const results = await lookup.lookup('Dr. Jane Smith', [
      'Smith JA (2015). Migraine outcomes after cervical fusion. Spine, 1, 1-2.',
      'Spine study of lumbar fusion rates',
      'A paper nobody indexed anywhere',
      'Too short',
    ]);
    expect(results.map((result) => [result.title, result.status])).toEqual([
      [
        'Smith JA (2015). Migraine outcomes after cervical fusion. Spine, 1, 1-2.',
        'authored',
      ],
      // One catalog alone never proves the expert did not write the paper.
      ['Spine study of lumbar fusion rates', 'author_unconfirmed'],
      ['A paper nobody indexed anywhere', 'not_found'],
    ]);
    expect(results[0].work).toMatchObject({
      url: 'https://doi.org/10.1/m',
      year: 2015,
      authors: ['Jane A. Smith', 'Ann Lee'],
    });
    expect(results[0]).toMatchObject({
      authorPosition: 'first',
      authorCount: 2,
    });
    expect(results[1].authorListIncomplete).toBe(true);
  });

  const hanlon =
    'Hanlon, R.E., Demery, J.A., Martinovich, Z., & Kelly, J.P. (1999). Axial movements are relatively preserved in closed head injury. Brain Injury, 13, 1-9.';

  function demeryFetch(options: { crossrefAuthors: boolean }) {
    return fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({
          results: [
            {
              id: 'https://openalex.org/W9',
              title:
                'Axial movements are relatively preserved in closed head injury',
              publication_year: 1999,
              // OpenAlex has a one-author record, as in the Demery report.
              authorships: [{ author: { display_name: 'Robert E. Hanlon' } }],
            },
          ],
        }),
      },
      {
        match: (url) => url.host === 'api.crossref.org',
        respond: () => ({
          message: {
            items: [
              {
                DOI: '10.1/axial',
                URL: 'https://doi.org/10.1/axial',
                title: [
                  'Axial movements are relatively preserved in closed head injury',
                ],
                issued: { 'date-parts': [[1999]] },
                author: options.crossrefAuthors
                  ? [
                      { given: 'Robert E.', family: 'Hanlon' },
                      { given: 'Jason A.', family: 'Demery' },
                      { given: 'Z.', family: 'Martinovich' },
                      { given: 'J. P.', family: 'Kelly' },
                    ]
                  : [{ given: 'Robert E.', family: 'Hanlon' }],
              },
            ],
          },
        }),
      },
    ]);
  }

  it('finds the expert as second author when another catalog has the full list', async () => {
    const fake = demeryFetch({ crossrefAuthors: true });
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
      undefined,
      new CrossrefClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const [result] = await lookup.lookup('Jason A. Demery', [hanlon]);
    expect(result).toMatchObject({
      status: 'authored',
      catalog: 'Crossref',
      authorPosition: 'middle',
      authorIndex: 1,
      authorCount: 4,
      cvAuthorPosition: 'middle',
      positionCheck: 'confirmed',
    });
  });

  it('reports an unconfirmed author list, not a conflict, when every list is short', async () => {
    const fake = demeryFetch({ crossrefAuthors: false });
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
      undefined,
      new CrossrefClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const [result] = await lookup.lookup('Jason A. Demery', [hanlon]);
    expect(result.status).toBe('author_unconfirmed');
    expect(result.authorListIncomplete).toBe(true);
    expect(result.cvAuthorCount).toBe(4);
  });

  it('matches by DOI when the title search misses', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: (url) => {
          const filter = url.searchParams.get('filter') ?? '';
          if (filter.includes('doi:10.1000/xyz')) {
            return {
              results: [
                {
                  id: 'https://openalex.org/Wdoi',
                  doi: 'https://doi.org/10.1000/xyz',
                  title: 'The catalog title of the matched article',
                  publication_year: 2018,
                  type: 'article',
                  authorships: [
                    { author: { display_name: 'Jane A. Smith' } },
                    { author: { display_name: 'Ann Lee' } },
                  ],
                },
              ],
            };
          }
          return { results: [] };
        },
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const [result] = await lookup.lookup('Jane Smith', [
      {
        title: 'A completely different wording that would not match',
        doi: '10.1000/xyz',
        year: 2018,
      },
    ]);
    expect(result).toMatchObject({
      status: 'authored',
      matchMethod: 'doi',
      doi: '10.1000/xyz',
      authorPosition: 'first',
    });
    expect(fake.calls.some((call) => call.url.searchParams.has('search'))).toBe(
      false,
    );
  });

  it('matches by PMID when the title search misses', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({ results: [] }),
      },
      {
        match: (url) => url.pathname.endsWith('esummary.fcgi'),
        respond: () => ({
          result: {
            '99887766': {
              title: 'Catalog title for the pmid record',
              pubdate: '2016',
              fulljournalname: 'Cortex',
              authors: [{ name: 'Smith JA' }, { name: 'Lee A' }],
              articleids: [{ idtype: 'doi', value: '10.1000/pmid' }],
            },
          },
        }),
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
      { timeoutMs: 1000, fetchImpl: fake.fetch },
    );
    const [result] = await lookup.lookup('Jane Smith', [
      {
        title: 'Wording that does not appear in any catalog title list',
        pmid: '99887766',
      },
    ]);
    expect(result).toMatchObject({
      status: 'authored',
      catalog: 'PubMed',
      matchMethod: 'pmid',
      pmid: '99887766',
      doi: '10.1000/pmid',
    });
    expect(result.work?.url).toBe('https://pubmed.ncbi.nlm.nih.gov/99887766/');
  });

  it('uses journal, year, and coauthors when the title is only a partial match', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({
          results: [
            {
              id: 'https://openalex.org/Wpartial',
              doi: 'https://doi.org/10.1000/partial',
              title: 'Axial movements relatively preserved after closed injury',
              publication_year: 1999,
              primary_location: {
                source: { display_name: 'Brain Injury' },
              },
              authorships: [
                { author: { display_name: 'Robert E. Hanlon' } },
                { author: { display_name: 'Jason A. Demery' } },
              ],
            },
          ],
        }),
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const [result] = await lookup.lookup('Jason A. Demery', [
      {
        title: 'Axial movements are relatively preserved in closed head injury',
        citation:
          'Hanlon RE, Demery JA (1999). Axial movements are relatively preserved in closed head injury. Brain Injury, 13, 1-9.',
        journal: 'Brain Injury',
        year: 1999,
      },
    ]);
    expect(result.status).toBe('authored');
    expect(result.venue).toBe('Brain Injury');
    expect(result.work?.year).toBe(1999);
  });

  it('does not query PubMed for a book chapter and does not invent a journal match', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({ results: [] }),
      },
      {
        match: (url) => url.host === 'api.crossref.org',
        respond: () => ({ message: { items: [] } }),
      },
      {
        match: (url) => url.host.includes('ncbi.nlm.nih.gov'),
        respond: () => {
          throw new Error('PubMed must not be queried for a chapter');
        },
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
      { timeoutMs: 1000, fetchImpl: fake.fetch },
      new CrossrefClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const [result] = await lookup.lookup('Jane Smith', [
      {
        title: 'Neuropsychology of traumatic brain injury in adults',
        citation:
          'Smith JA (2010). Neuropsychology of traumatic brain injury in adults. In: Handbook of Neuropsychology.',
        type: 'chapter',
      },
    ]);
    expect(result.status).toBe('not_found');
    expect(result.publicationType).toBe('chapter');
    expect(
      fake.calls.some((call) => call.url.host.includes('ncbi.nlm.nih.gov')),
    ).toBe(false);
  });

  it('deduplicates the same citation and does not call Crossref when OpenAlex has a complete author list', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({
          results: [
            {
              id: 'https://openalex.org/Wdup',
              doi: 'https://doi.org/10.1000/dup',
              title: 'Migraine outcomes after cervical fusion',
              publication_year: 2015,
              authorships: [
                { author: { display_name: 'Jane A. Smith' } },
                { author: { display_name: 'Ann Lee' } },
              ],
            },
          ],
        }),
      },
      {
        match: (url) => url.host === 'api.crossref.org',
        respond: () => {
          throw new Error('Crossref should not be queried');
        },
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
      undefined,
      new CrossrefClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const results = await lookup.lookup('Jane Smith', [
      'Smith JA, Lee A (2015). Migraine outcomes after cervical fusion. Spine, 1, 1-2.',
      'Smith JA, Lee A (2015). Migraine outcomes after cervical fusion. Spine, 1, 1-2.',
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('authored');
    expect(
      fake.calls.some((call) => call.url.host === 'api.crossref.org'),
    ).toBe(false);
  });

  it('says author position is not verifiable when the catalog list is truncated', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({
          results: [
            {
              id: 'https://openalex.org/Wtrunc',
              title:
                'Axial movements are relatively preserved in closed head injury',
              publication_year: 1999,
              is_authors_truncated: true,
              authorships: [
                { author: { display_name: 'Robert E. Hanlon' } },
                { author: { display_name: 'Jason A. Demery' } },
              ],
            },
          ],
        }),
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    const [result] = await lookup.lookup('Jason A. Demery', [hanlon]);
    expect(result.status).toBe('authored');
    expect(result.positionCheck).toBe('not_verifiable');
    expect(result.authorListIncomplete).toBe(true);
  });

  it('uses ORCID for a DOI the other catalogs missed without claiming authorship', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({ results: [] }),
      },
      {
        match: (url) => url.pathname === '/oauth/token',
        respond: () => ({ access_token: 'tok', expires_in: 3600 }),
      },
      {
        match: (url) => url.pathname.includes('/expanded-search'),
        respond: () => ({
          'num-found': 1,
          'expanded-result': [
            {
              'orcid-id': '0000-0002-1825-0097',
              'given-names': 'Jason',
              'family-names': 'Demery',
            },
          ],
        }),
      },
      {
        match: (url) => url.pathname.endsWith('/0000-0002-1825-0097/record'),
        respond: () => ({
          person: {
            name: {
              'given-names': { value: 'Jason' },
              'family-name': { value: 'Demery' },
            },
          },
          'activities-summary': {
            works: {
              group: [
                {
                  'work-summary': [
                    {
                      title: { title: { value: 'Memory after mild TBI' } },
                      'external-ids': {
                        'external-id': [
                          {
                            'external-id-type': 'doi',
                            'external-id-value': '10.1000/tbi',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          },
        }),
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
      undefined,
      undefined,
      new OrcidClient({
        timeoutMs: 1000,
        fetchImpl: fake.fetch,
        clientId: 'APP-TEST',
        clientSecret: 'secret',
      }),
    );
    const [result] = await lookup.lookup('Jason A. Demery', [
      { title: 'Memory after mild TBI', doi: '10.1000/tbi', type: 'chapter' },
    ]);
    expect(result.catalog).toBe('ORCID');
    expect(result.status).toBe('author_unconfirmed');
    expect(result.doi).toBe('10.1000/tbi');
    expect(result.authorListIncomplete).toBe(true);
  });

  it('does not call ORCID when OpenAlex already found the work', async () => {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'api.openalex.org',
        respond: () => ({
          results: [
            {
              id: 'https://openalex.org/W-orcid-skip',
              doi: 'https://doi.org/10.1000/tbi',
              title: 'Memory after mild TBI',
              publication_year: 2018,
              authorships: [{ author: { display_name: 'Jason A. Demery' } }],
            },
          ],
        }),
      },
      {
        match: (url) =>
          url.pathname === '/oauth/token' ||
          url.pathname.includes('orcid.org') ||
          url.host.includes('orcid.org'),
        respond: () => {
          throw new Error('ORCID should not be called');
        },
      },
    ]);
    const lookup = new PublicationTitleLookup(
      new OpenAlexClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
      undefined,
      undefined,
      new OrcidClient({
        timeoutMs: 1000,
        fetchImpl: fake.fetch,
        clientId: 'APP-TEST',
        clientSecret: 'secret',
      }),
    );
    const [result] = await lookup.lookup('Jason A. Demery', [
      { title: 'Memory after mild TBI', doi: '10.1000/tbi' },
    ]);
    expect(result.catalog).toBe('OpenAlex');
    expect(result.status).toBe('authored');
  });
});
