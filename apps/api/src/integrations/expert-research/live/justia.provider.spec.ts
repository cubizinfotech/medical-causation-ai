import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import { parseJustiaHits, JustiaResearchProvider } from './justia.provider';

const definition = EXPERT_RESEARCH_CATALOG.find((entry) => entry.id === 'justia');

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
        Promise.resolve(
          new Response('Just a moment', { status: 200 }),
        ),
      ) as unknown as typeof fetch,
    );
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: 'Gainesville',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not a finding/i);
    expect(result.items).toHaveLength(0);
  });
});
