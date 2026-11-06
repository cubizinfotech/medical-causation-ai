import { createClaimScopedWebLookup } from './claim-scoped-web-lookup';

describe('createClaimScopedWebLookup', () => {
  it('returns null when no SERP provider is configured', () => {
    expect(
      createClaimScopedWebLookup({
        providers: ['serper', 'brave'],
        maxQueries: 10,
        maxPages: 10,
        searchTimeoutMs: 1000,
        fetchTimeoutMs: 1000,
        maxFetchPages: 5,
        deadlineMs: 60_000,
        archiveFallback: false,
      }),
    ).toBeNull();
  });

  it('is configured when a Serper key is present', () => {
    const lookup = createClaimScopedWebLookup({
      providers: ['serper'],
      serperApiKey: 'test-key',
      maxQueries: 10,
      maxPages: 10,
      searchTimeoutMs: 1000,
      fetchTimeoutMs: 1000,
      maxFetchPages: 5,
      deadlineMs: 60_000,
      archiveFallback: false,
    });
    expect(lookup?.isConfigured).toBe(true);
    expect(typeof lookup?.search).toBe('function');
    expect(typeof lookup?.fetchPage).toBe('function');
  });
});
