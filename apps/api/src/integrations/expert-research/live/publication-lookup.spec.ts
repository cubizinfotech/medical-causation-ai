import { OpenAlexClient } from './openalex.client';
import { PublicationTitleLookup, sameTitle } from './publication-lookup';
import { fakeFetch } from './testing/live-fakes';

describe('publication title lookup', () => {
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
      'Migraine outcomes after cervical fusion',
      'Spine study of lumbar fusion rates',
      'A paper nobody indexed anywhere',
      'Too short',
    ]);
    expect(results.map((result) => [result.title, result.status])).toEqual([
      ['Migraine outcomes after cervical fusion', 'authored'],
      ['Spine study of lumbar fusion rates', 'not_author'],
      ['A paper nobody indexed anywhere', 'not_found'],
    ]);
    expect(results[0].work).toMatchObject({
      url: 'https://doi.org/10.1/m',
      year: 2015,
      authors: ['Jane A. Smith', 'Ann Lee'],
    });
  });
});
