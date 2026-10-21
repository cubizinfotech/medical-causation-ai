import {
  classifyPublicationType,
  normalizeDoi,
  parsePmid,
  parseYear,
  toPublicationQuery,
} from './publication-citation';
import { sameTitle as sameLookupTitle } from './publication-lookup';

describe('publication citation fields', () => {
  it('normalizes DOI, PMID, and year from a CV line', () => {
    expect(normalizeDoi('https://doi.org/10.1000/xyz,')).toBe('10.1000/xyz');
    expect(parsePmid('PMID: 12345678')).toBe('12345678');
    expect(parsePmid('https://pubmed.ncbi.nlm.nih.gov/12345678/')).toBe(
      '12345678',
    );
    expect(parseYear('Hanlon RE (1998a). A title.')).toBe(1998);
  });

  it('classifies articles, chapters, abstracts, and presentations', () => {
    expect(
      classifyPublicationType(
        'Smith JA (2015). A journal article. Spine, 1, 1-2.',
        'PUBLICATIONS',
      ),
    ).toBe('article');
    expect(
      classifyPublicationType(
        'Smith JA (2010). A chapter. In: Handbook of Neuropsychology.',
        'BOOK CHAPTERS',
      ),
    ).toBe('chapter');
    expect(
      classifyPublicationType(
        'Smith JA (1999). A poster that is not a journal article.',
        'PUBLISHED ABSTRACTS',
      ),
    ).toBe('abstract');
    expect(
      classifyPublicationType(
        'Smith JA (2001). Conference presentation on TBI.',
        'OTHER PRESENTATIONS',
      ),
    ).toBe('presentation');
  });

  it('fills a query from a citation string without inventing identifiers', () => {
    const query = toPublicationQuery(
      'Hanlon RE, Demery JA (1998). Axial movements are relatively preserved. Cortex, 34, 731-741.',
    );
    expect(query.year).toBe(1998);
    expect(query.doi).toBeUndefined();
    expect(query.pmid).toBeUndefined();
    expect(query.type).toBe('other');
  });
});

describe('title normalization', () => {
  it('treats punctuation and citation-format differences as the same title', () => {
    expect(
      sameLookupTitle(
        'Axial movements are relatively preserved.',
        'Axial Movements Are Relatively Preserved!',
      ),
    ).toBe(true);
    expect(
      sameLookupTitle(
        'Migraine outcomes after cervical fusion: a cohort study',
        'Migraine outcomes after cervical fusion',
      ),
    ).toBe(true);
  });
});
