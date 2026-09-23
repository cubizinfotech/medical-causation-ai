import { fetchResearch, UpstreamHttpError } from './research-http';

describe('fetchResearch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('retries on 429 then returns the successful response', async () => {
    const calls = { n: 0 };
    global.fetch = jest.fn(() => {
      calls.n += 1;
      if (calls.n === 1) {
        return Promise.resolve(
          new Response('slow down', {
            status: 429,
            headers: { 'retry-after': '0' },
          }),
        );
      }
      return Promise.resolve(new Response('ok', { status: 200 }));
    }) as typeof fetch;

    const response = await fetchResearch(
      'https://example.test/search',
      { method: 'GET' },
      { timeoutMs: 1000, maxRetries: 2, retryDelayMs: 1 },
    );

    expect(response.status).toBe(200);
    expect(calls.n).toBe(2);
  });

  it('throws UpstreamHttpError for non-retryable client errors', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response('nope', { status: 400 })),
    ) as typeof fetch;

    await expect(
      fetchResearch(
        'https://example.test/search',
        { method: 'GET' },
        { timeoutMs: 1000, maxRetries: 2, retryDelayMs: 1 },
      ),
    ).rejects.toBeInstanceOf(UpstreamHttpError);
  });
});
