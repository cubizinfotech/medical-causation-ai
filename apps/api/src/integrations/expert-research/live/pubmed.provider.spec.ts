import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import { authorListed, PubMedResearchProvider } from './pubmed.provider';
import { parsePersonName } from './person-name';

const definition = EXPERT_RESEARCH_CATALOG.find((entry) => entry.id === 'pubmed');
const name = parsePersonName('Jason A. Demery');

describe('PubMed author matching', () => {
  it('accepts initials and a spelled first name, and rejects a different middle initial', () => {
    if (!name) throw new Error('name');
    expect(authorListed('Demery JA', name)).toBe(true);
    expect(authorListed('Demery, Jason A', name)).toBe(true);
    expect(authorListed('Demery JB', name)).toBe(false);
    expect(authorListed('Smith JA', name)).toBe(false);
  });
});

describe('PubMedResearchProvider', () => {
  it('keeps an article only when the author list matches', async () => {
    if (!definition) throw new Error('pubmed catalog entry missing');
    const fetchImpl = jest.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const body = url.pathname.endsWith('esearch.fcgi')
        ? { esearchresult: { idlist: ['99', '100'] } }
        : {
            result: {
              uids: ['99', '100'],
              '99': {
                uid: '99',
                title: 'Memory after mild TBI',
                pubdate: '2018 Jan',
                fulljournalname: 'Journal of Neuropsychology',
                authors: [{ name: 'Demery JA' }, { name: 'Other AB' }],
              },
              '100': {
                uid: '100',
                title: 'Unrelated',
                authors: [{ name: 'Demery JB' }],
              },
            },
          };
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 }),
      );
    }) as typeof fetch;
    const provider = new PubMedResearchProvider(
      definition,
      fetchImpl,
      1000,
    );
    const result = await provider.search({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('ok');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.url).toBe('https://pubmed.ncbi.nlm.nih.gov/99/');
    expect(result.items[0]?.informationStatus).toBe('unverified');
    expect(result.items[0]?.summary).toMatch(/not proof/);
  });
});
