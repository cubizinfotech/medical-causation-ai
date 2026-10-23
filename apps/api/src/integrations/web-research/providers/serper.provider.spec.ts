import { SerperSearchProvider } from './serper.provider';

describe('SerperSearchProvider', () => {
  it('is unconfigured without a key and does not treat that as an empty search', () => {
    const provider = new SerperSearchProvider(undefined);
    expect(provider.isConfigured()).toBe(false);
    expect(provider.id).toBe('serper');
  });

  it('is configured when SERPER_API_KEY is supplied through the constructor', () => {
    expect(new SerperSearchProvider('test-serper-key').isConfigured()).toBe(
      true,
    );
  });

  it('preserves titles, snippets, and source URLs from organic hits', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            organic: [
              {
                title: 'Jane Smith, MD — Neurology',
                link: 'https://example.edu/jane-smith',
                snippet: 'Associate professor of neurology in Phoenix.',
              },
              {
                title: 'Duplicate',
                link: 'https://example.edu/jane-smith',
                snippet: 'Same page',
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const provider = new SerperSearchProvider(
      'test-serper-key',
      fetchImpl as typeof fetch,
    );
    const hits = await provider.search(
      { query: '"Jane Smith" neurology Phoenix', kind: 'web', num: 10 },
      1000,
    );
    expect(hits).toHaveLength(2);
    expect(hits[0]?.url).toBe('https://example.edu/jane-smith');
    expect(hits[0]?.title).toMatch(/Jane Smith/);
    expect(hits[0]?.snippet).toMatch(/Phoenix/);
    expect(hits[0]?.providerId).toBe('serper');
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('surfaces credential rejection without inventing search hits', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(new Response('denied', { status: 401 })),
    ) as typeof fetch;
    const provider = new SerperSearchProvider('test-serper-key', fetchImpl);
    await expect(
      provider.search({ query: 'test', kind: 'web' }, 1000),
    ).rejects.toThrow(/401|credential/i);
  });
});
