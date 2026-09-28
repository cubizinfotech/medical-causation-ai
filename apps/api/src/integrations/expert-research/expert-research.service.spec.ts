import {
  createCatalogProviders,
  ExpertResearchService,
} from './expert-research.service';
import { CatalogExpertResearchProvider } from './providers/catalog-expert-research.provider';
import { EXPERT_RESEARCH_CATALOG } from './providers/provider-catalog';
import { ProviderRateLimiter } from './providers/provider-runtime';

describe('ExpertResearchService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns development fixtures in mock mode and does not call the network', async () => {
    global.fetch = jest.fn(() => {
      throw new Error('network must not be used');
    }) as typeof fetch;

    const service = serviceWith({
      mode: 'mock',
      timeoutMs: 1000,
      minIntervalMs: 0,
    });
    const results = await service.collect({
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
    });

    expect(global.fetch).not.toHaveBeenCalled();
    const pubmed = results.find((result) => result.sourceId === 'pubmed');
    expect(pubmed?.status).toBe('ok');
    expect(pubmed?.items[0]?.informationStatus).toBe('unverified');
    expect(pubmed?.items[0]?.retrievedAt).toEqual(expect.any(String));
    expect(pubmed?.items[0]?.source?.url).toContain('pubmed.example.local');

    const orcid = results.find((result) => result.sourceId === 'orcid');
    expect(orcid?.status).toBe('unavailable');
    expect(orcid?.items).toEqual([]);
  });

  it('stores LexisNexis fixtures as a link without content', async () => {
    const service = serviceWith({
      mode: 'mock',
      timeoutMs: 1000,
      minIntervalMs: 0,
    });
    const results = await service.collect({
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
    });
    const lexis = results.find((result) => result.sourceId === 'lexisnexis');
    expect(lexis?.access).toBe('restricted');
    expect(lexis?.items[0]?.summary).toBe('');
    expect(lexis?.items[0]?.url).toBe('https://advance.lexis.com/example');
    expect(lexis?.items[0]?.raw).toEqual({ metadataOnly: true, fixture: true });
  });

  it('marks disagreeing license fixtures as conflicting without adding records', async () => {
    const service = serviceWith({
      mode: 'mock',
      timeoutMs: 1000,
      minIntervalMs: 0,
    });
    const results = await service.collect({
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
    });
    const licenses = results
      .flatMap((result) => result.items)
      .filter((item) => item.category === 'license');
    expect(licenses.length).toBeGreaterThan(0);
    expect(
      licenses.every((item) => item.informationStatus === 'conflicting'),
    ).toBe(true);
  });

  it('returns unavailable for every provider in live mode and does not call the network', async () => {
    global.fetch = jest.fn() as typeof fetch;
    const service = serviceWith({
      mode: 'live',
      timeoutMs: 1000,
      minIntervalMs: 0,
    });
    const results = await service.collect({
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
    });
    expect(results).toHaveLength(EXPERT_RESEARCH_CATALOG.length);
    expect(results.every((result) => result.items.length === 0)).toBe(true);
    expect(results.every((result) => result.status === 'unavailable')).toBe(
      true,
    );
    expect(global.fetch).not.toHaveBeenCalled();
    const lexis = results.find((result) => result.sourceId === 'lexisnexis');
    expect(lexis?.message).toMatch(/no request was sent/i);
  });

  it('returns an error and no items when the name is missing', async () => {
    const service = serviceWith({
      mode: 'mock',
      timeoutMs: 1000,
      minIntervalMs: 0,
    });
    const results = await service.collect({
      expertName: ' ',
      city: 'Boston',
      specialty: 'Ortho',
    });
    expect(results).toHaveLength(EXPERT_RESEARCH_CATALOG.length);
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.items).toEqual([]);
  });

  it('reports a provider timeout without inventing items', async () => {
    const pubmed = EXPERT_RESEARCH_CATALOG.find((item) => item.id === 'pubmed');
    if (!pubmed) throw new Error('pubmed catalog entry missing');
    const provider = new CatalogExpertResearchProvider(
      pubmed,
      { mode: 'mock', timeoutMs: 5, minIntervalMs: 0 },
      new ProviderRateLimiter(),
      () => new Promise((resolve) => setTimeout(() => resolve([]), 30)),
    );
    const result = await provider.search({
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/timed out/i);
    expect(result.items).toEqual([]);
  });

  it('returns no result for an empty fixture without inventing a record', async () => {
    const service = serviceWith({
      mode: 'mock',
      timeoutMs: 1000,
      minIntervalMs: 0,
    });
    const results = await service.collect({
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
    });
    const trademarks = results.find((result) => result.sourceId === 'trademarks');
    expect(trademarks?.status).toBe('no_result');
    expect(trademarks?.outcome).toBe('no_result');
    expect(trademarks?.items).toEqual([]);
    expect(trademarks?.message).toMatch(/does not establish/i);
  });

  it('does not merge a same-name record from another city', async () => {
    const service = serviceWith({
      mode: 'mock',
      timeoutMs: 1000,
      minIntervalMs: 0,
    });
    const results = await service.collect({
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
    });
    const profiles = results
      .flatMap((result) => result.items)
      .filter((item) => item.sourceId === 'web_search');
    expect(profiles.map((item) => item.identityMatch)).toEqual([
      'matched',
      'uncertain',
    ]);
  });

  it('keeps collecting when one provider fails', async () => {
    const pubmed = EXPERT_RESEARCH_CATALOG.find((item) => item.id === 'pubmed');
    const patents = EXPERT_RESEARCH_CATALOG.find((item) => item.id === 'patents');
    if (!pubmed || !patents) throw new Error('catalog entries missing');
    const service = new ExpertResearchService([
      new CatalogExpertResearchProvider(
        pubmed,
        { mode: 'mock', timeoutMs: 1000, minIntervalMs: 0 },
        new ProviderRateLimiter(),
        () => Promise.reject(new Error('API failure')),
      ),
      new CatalogExpertResearchProvider(
        patents,
        { mode: 'mock', timeoutMs: 1000, minIntervalMs: 0 },
        new ProviderRateLimiter(),
      ),
    ]);
    const results = await service.collectProviders(
      {
        expertName: 'Jane Smith',
        city: 'Boston',
        specialty: 'Orthopedics',
      },
      ['pubmed', 'patents'],
    );
    expect(results[0]?.outcome).toBe('api_failure');
    expect(results[0]?.items).toEqual([]);
    expect(results[1]?.status).toBe('ok');
    expect(results[1]?.items.length).toBeGreaterThan(0);
  });
});

function serviceWith(runtime: {
  mode: 'mock' | 'live';
  timeoutMs: number;
  minIntervalMs: number;
}): ExpertResearchService {
  return new ExpertResearchService(createCatalogProviders(runtime));
}
