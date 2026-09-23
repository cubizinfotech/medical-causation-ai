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
      specialty: 'Orthopedics',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/timed out/i);
    expect(result.items).toEqual([]);
  });
});

function serviceWith(runtime: {
  mode: 'mock' | 'live';
  timeoutMs: number;
  minIntervalMs: number;
}): ExpertResearchService {
  return new ExpertResearchService(createCatalogProviders(runtime));
}
