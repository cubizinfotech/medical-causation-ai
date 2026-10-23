import { SearchProviderError } from '../web-research.types';
import { searchHttp } from './search-http';

describe('searchHttp', () => {
  it('treats HTTP 400 not-enough-credits as a quota error', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'Not enough credits' }), {
          status: 400,
        }),
      ),
    ) as typeof fetch;
    await expect(
      searchHttp('https://google.serper.dev/search', {
        timeoutMs: 1000,
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: 'SearchProviderError',
      kind: 'quota',
      status: 400,
    });
    await expect(
      searchHttp('https://google.serper.dev/search', {
        timeoutMs: 1000,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(SearchProviderError);
  });

  it('treats a bare HTTP 400 from Serper as a quota error', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(new Response('', { status: 400 })),
    ) as typeof fetch;
    await expect(
      searchHttp('https://google.serper.dev/search', {
        timeoutMs: 1000,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ kind: 'quota', status: 400 });
  });

  it('does not treat a generic HTTP 400 from another host as a quota error', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(new Response('bad request', { status: 400 })),
    ) as typeof fetch;
    await expect(
      searchHttp('https://api.example/search', {
        timeoutMs: 1000,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ kind: 'http', status: 400 });
  });
});
