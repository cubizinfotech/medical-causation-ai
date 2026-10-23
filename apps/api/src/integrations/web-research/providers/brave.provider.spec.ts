import { BraveSearchProvider } from './brave.provider';

describe('BraveSearchProvider', () => {
  it('sends offset as the zero-based page index, not count times page', async () => {
    let called = '';
    const fetchImpl = ((input: RequestInfo | URL) => {
      called =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return Promise.resolve(
        new Response(JSON.stringify({ web: { results: [] } }), {
          status: 200,
        }),
      );
    }) as typeof fetch;
    const provider = new BraveSearchProvider('brave-test-key', fetchImpl);
    await provider.search(
      { query: 'Jane Smith neurology', kind: 'web', num: 20, page: 2 },
      1000,
    );
    expect(called).toContain('offset=1');
    expect(called).toContain('count=20');
    expect(called).not.toContain('offset=20');
  });
});
