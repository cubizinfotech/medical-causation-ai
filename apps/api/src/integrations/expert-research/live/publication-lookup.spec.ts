import { CrossrefClient } from './crossref.client';
import { OpenAlexClient } from './openalex.client';
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
});
