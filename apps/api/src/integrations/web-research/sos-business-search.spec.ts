import { sosBusinessSearchUrl, sosDeepLinksFor } from './sos-business-search';

describe('sosBusinessSearchUrl', () => {
  it('returns official search URLs for every common state code', () => {
    expect(sosBusinessSearchUrl('CA')).toMatch(/sos\.ca\.gov/i);
    expect(sosBusinessSearchUrl('CO')).toMatch(/coloradosos\.gov/i);
    expect(sosBusinessSearchUrl('FL')).toMatch(/sunbiz\.org/i);
    expect(sosBusinessSearchUrl('NY')).toMatch(/dos\.ny\.gov/i);
    expect(sosBusinessSearchUrl('xx')).toBeNull();
  });

  it('builds deep links for named entities across the given states', () => {
    const links = sosDeepLinksFor(['Acme Neuropsychology LLC'], ['CA', 'CO']);
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.state).sort()).toEqual(['CA', 'CO']);
    expect(links.every((link) => link.entityName.includes('Acme'))).toBe(true);
  });
});
