import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import {
  affiliationAgrees,
  authorListed,
  parseArticleGrants,
  parseAuthorAffiliations,
  PubMedResearchProvider,
} from './pubmed.provider';
import { parsePersonName } from './person-name';

const definition = EXPERT_RESEARCH_CATALOG.find(
  (entry) => entry.id === 'pubmed',
);
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
    const provider = new PubMedResearchProvider(definition, fetchImpl, 1000);
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

const EFETCH = `<PubmedArticleSet>
<PubmedArticle><MedlineCitation><PMID Version="1">99</PMID><Article><AuthorList>
<Author><LastName>Demery</LastName><ForeName>Jason A</ForeName><Initials>JA</Initials>
<AffiliationInfo><Affiliation>UF Springhill Health Center, 8491 NW 39th Ave, Gainesville, FL, USA.</Affiliation></AffiliationInfo></Author>
<Author><LastName>Other</LastName><ForeName>Ann B</ForeName><Initials>AB</Initials>
<AffiliationInfo><Affiliation>Department of Surgery, Dallas, TX.</Affiliation></AffiliationInfo></Author>
</AuthorList></Article></MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation><PMID Version="1">100</PMID><Article><AuthorList>
<Author><LastName>Demery</LastName><ForeName>Jason A</ForeName><Initials>JA</Initials>
<AffiliationInfo><Affiliation>Department of Roofing Science, Dallas, TX.</Affiliation></AffiliationInfo></Author>
</AuthorList></Article></MedlineCitation></PubmedArticle>
</PubmedArticleSet>`;

describe('PubMed affiliation check', () => {
  it('reads the affiliation of the expert’s own author entry only', () => {
    if (!name) throw new Error('name');
    const map = parseAuthorAffiliations(EFETCH, name);
    expect(map.get('99')).toEqual([
      'UF Springhill Health Center, 8491 NW 39th Ave, Gainesville, FL, USA.',
    ]);
  });

  it('agrees on place or specialty and rejects an unrelated affiliation', () => {
    const query = {
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    };
    expect(
      affiliationAgrees(
        ['UF Springhill Health Center, Gainesville, FL'],
        query,
      ),
    ).toMatch(/place: gainesville/);
    expect(
      affiliationAgrees(
        ['Department of Neuropsychological Sciences, Ohio'],
        query,
      ),
    ).toMatch(/specialty/);
    expect(
      affiliationAgrees(['Department of Roofing Science, Dallas, TX'], query),
    ).toBeNull();
    expect(affiliationAgrees([], query)).toBeNull();
  });

  it('attributes the article with a matching affiliation and lists the other by title', async () => {
    if (!definition) throw new Error('pubmed catalog entry missing');
    const fetchImpl = jest.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith('efetch.fcgi')) {
        return Promise.resolve(new Response(EFETCH, { status: 200 }));
      }
      const body = url.pathname.endsWith('esearch.fcgi')
        ? { esearchresult: { idlist: ['99', '100'] } }
        : {
            result: {
              uids: ['99', '100'],
              '99': {
                uid: '99',
                title: 'Memory after mild TBI',
                pubdate: '2018 Jan',
                authors: [{ name: 'Demery JA' }],
              },
              '100': {
                uid: '100',
                title: 'Shingle durability',
                pubdate: '2015',
                authors: [{ name: 'Demery JA' }],
              },
            },
          };
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 }),
      );
    }) as typeof fetch;
    const provider = new PubMedResearchProvider(definition, fetchImpl, 1000);
    const result = await provider.search({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    const first = result.items.find((i) => i.url?.endsWith('/99/'));
    const second = result.items.find((i) => i.url?.endsWith('/100/'));
    expect(first?.raw?.identity).toMatchObject({ verifiedBy: 'source_match' });
    expect(second?.raw?.identity).toBeUndefined();
    expect(result.message).toMatch(/1 also list an affiliation that agrees/);
    expect(result.message).toMatch(/Shingle durability/);
  });
});

describe('PubMed grant list', () => {
  it('reads article-level grants without treating them as a personal award', () => {
    const xml = `<PubmedArticleSet>
<PubmedArticle><MedlineCitation><PMID Version="1">99</PMID>
<GrantList>
<Grant><GrantID>R01NS012345</GrantID><Agency>NINDS NIH HHS</Agency></Grant>
</GrantList>
</MedlineCitation></PubmedArticle>
</PubmedArticleSet>`;
    const grants = parseArticleGrants(xml);
    expect(grants.get('99')).toEqual([
      { id: 'R01NS012345', agency: 'NINDS NIH HHS' },
    ]);
  });

  it('keeps Demery paper acknowledgements on the article and does not emit grant findings', async () => {
    if (!definition) throw new Error('pubmed catalog entry missing');
    const xml = `<PubmedArticleSet>
<PubmedArticle><MedlineCitation><PMID Version="1">21069617</PMID>
<Article><AuthorList>
<Author><LastName>Demery</LastName><ForeName>Jason A</ForeName><Initials>JA</Initials>
<AffiliationInfo><Affiliation>Gainesville, FL neuropsychology.</Affiliation></AffiliationInfo></Author>
<Author><LastName>Larson</LastName><ForeName>Michael J</ForeName></Author>
<Author><LastName>Dixit</LastName><ForeName>Neha K</ForeName></Author>
<Author><LastName>Bauer</LastName><ForeName>Russell M</ForeName></Author>
<Author><LastName>Perlstein</LastName><ForeName>William M</ForeName></Author>
</AuthorList></Article>
<GrantList>
<Grant><GrantID>K01 MH001857</GrantID><Agency>NIMH NIH HHS</Agency></Grant>
<Grant><GrantID>K01 MH01857</GrantID><Agency>NIMH NIH HHS</Agency></Grant>
<Grant><GrantID>R21 MH073076</GrantID><Agency>NIMH NIH HHS</Agency></Grant>
</GrantList>
</MedlineCitation></PubmedArticle>
</PubmedArticleSet>`;
    const fetchImpl = jest.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith('efetch.fcgi')) {
        return Promise.resolve(new Response(xml, { status: 200 }));
      }
      const body = url.pathname.endsWith('esearch.fcgi')
        ? { esearchresult: { idlist: ['21069617'] } }
        : {
            result: {
              uids: ['21069617'],
              '21069617': {
                uid: '21069617',
                title:
                  'Operating characteristics of executive functioning tests following traumatic brain injury.',
                pubdate: '2010 Nov',
                fulljournalname: 'The Clinical neuropsychologist',
                authors: [
                  { name: 'Demery JA' },
                  { name: 'Larson MJ' },
                  { name: 'Dixit NK' },
                  { name: 'Bauer RM' },
                  { name: 'Perlstein WM' },
                ],
              },
            },
          };
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 }),
      );
    }) as typeof fetch;
    const result = await new PubMedResearchProvider(
      definition,
      fetchImpl,
      1000,
    ).search({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    expect(result.items.every((item) => item.category === 'publication')).toBe(
      true,
    );
    expect(result.items.some((item) => item.category === 'grant')).toBe(false);
    const paper = result.items[0];
    expect(paper?.raw?.grants).toEqual(
      expect.arrayContaining([
        { id: 'K01 MH001857', agency: 'NIMH NIH HHS' },
        { id: 'K01 MH01857', agency: 'NIMH NIH HHS' },
        { id: 'R21 MH073076', agency: 'NIMH NIH HHS' },
      ]),
    );
    expect(paper?.summary).toMatch(/not a personal grant award/i);
    expect(result.items.map((item) => item.title).join(' ')).not.toMatch(
      /K01 MH001857|R21 MH073076/,
    );
  });
});
