import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import { parseJustiaHits, JustiaResearchProvider } from './justia.provider';

const definition = EXPERT_RESEARCH_CATALOG.find(
  (entry) => entry.id === 'justia',
);

describe('parseJustiaHits', () => {
  it('keeps case links that mention the last name and drops other links', () => {
    const html = `
      <a href="https://law.justia.com/cases/florida/example/1/">Smith v. Jones, testimony of Jason Demery</a>
      <a href="https://law.justia.com/cases/florida/other/2/">Unrelated opinion</a>
      <a href="/cases/florida/relative/3/">Demery mentioned again</a>
    `;
    const hits = parseJustiaHits(html, 'Demery');
    expect(hits.map((hit) => hit.url)).toEqual([
      'https://law.justia.com/cases/florida/example/1/',
      'https://law.justia.com/cases/florida/relative/3/',
    ]);
  });
});

describe('JustiaResearchProvider', () => {
  it('reports an unreadable page as a failed search, not an empty finding', async () => {
    if (!definition) throw new Error('justia catalog entry missing');
    const provider = new JustiaResearchProvider(
      definition,
      jest.fn(() =>
        Promise.resolve(new Response('Just a moment', { status: 200 })),
      ),
    );
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('error');
    expect(result.outcome).toBe('restricted');
    expect(result.message).toMatch(/bot-protection|access wall/i);
    expect(result.message).toMatch(/not a finding/i);
    expect(result.items).toHaveLength(0);
  });

  it('reports HTTP 403 as blocked, not as no cases', async () => {
    if (!definition) throw new Error('justia catalog entry missing');
    const provider = new JustiaResearchProvider(
      definition,
      jest.fn(() =>
        Promise.resolve(new Response('Forbidden', { status: 403 })),
      ) as typeof fetch,
    );
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('error');
    expect(result.outcome).toBe('authentication_required');
    expect(result.message).toMatch(
      /blocked|not a finding that no case exists/i,
    );
  });

  it('records a completed empty search only when the results page is readable', async () => {
    if (!definition) throw new Error('justia catalog entry missing');
    const html = `<html><body>${'Justia search results for an unrelated query. '.repeat(8)}<a href="https://law.justia.com/cases/florida/example/1/">Unrelated v. Party</a></body></html>`;
    const provider = new JustiaResearchProvider(
      definition,
      jest.fn(() =>
        Promise.resolve(new Response(html, { status: 200 })),
      ) as typeof fetch,
    );
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('no_result');
    expect(result.outcome).toBe('no_result');
    expect(result.message).toMatch(/not proof that no case exists/i);
  });

  it('keeps last-name hits as unverified possible namesakes', async () => {
    if (!definition) throw new Error('justia catalog entry missing');
    const html = `<html><body>${'padding '.repeat(20)}<a href="https://law.justia.com/cases/florida/example/1/">Smith v. Jones, testimony of Jason Demery, 1:18-cv-22</a></body></html>`;
    const provider = new JustiaResearchProvider(
      definition,
      jest.fn(() =>
        Promise.resolve(new Response(html, { status: 200 })),
      ) as typeof fetch,
    );
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('ok');
    expect(result.items[0].raw).toMatchObject({
      identity: { ambiguous: true },
      docketCoverage: 'opinion_only',
      caseNumber: '1:18-cv-22',
    });
    expect(result.items[0].summary).toMatch(/complete case docket/i);
  });
});
