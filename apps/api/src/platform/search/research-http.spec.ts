import {
  assertPublicHttpUrl,
  UnsafeResearchUrlError,
} from './safe-research-url';
import { fetchResearch, UpstreamHttpError } from './research-http';

describe('assertPublicHttpUrl', () => {
  it('allows public https URLs', () => {
    expect(assertPublicHttpUrl('https://example.com/path').hostname).toBe(
      'example.com',
    );
  });

  it.each([
    'http://127.0.0.1/secret',
    'http://localhost/admin',
    'http://10.0.0.5/internal',
    'http://192.168.1.1/router',
    'http://169.254.169.254/latest/meta-data',
    'http://172.16.0.1/private',
    'file:///etc/passwd',
    'https://user:pass@example.com/x',
  ])('blocks unsafe URL %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(UnsafeResearchUrlError);
  });
});

describe('fetchResearch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects private targets before calling fetch', async () => {
    global.fetch = jest.fn() as typeof fetch;
    await expect(
      fetchResearch(
        'http://127.0.0.1/internal',
        { method: 'GET' },
        { timeoutMs: 1000, maxRetries: 1, retryDelayMs: 1 },
      ),
    ).rejects.toBeInstanceOf(UnsafeResearchUrlError);
    expect(global.fetch).not.toHaveBeenCalled();
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
