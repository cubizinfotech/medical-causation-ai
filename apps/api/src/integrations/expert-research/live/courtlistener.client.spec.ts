import { CourtListenerClient } from './courtlistener.client';

describe('CourtListenerClient pagination', () => {
  it('follows next pages up to the configured cap', async () => {
    const fetchImpl = jest.fn((input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('cursor=page2')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              next: null,
              results: [{ cluster_id: 2, caseName: 'Second' }],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            next: 'https://www.courtlistener.com/api/rest/v4/search/?cursor=page2',
            results: [{ cluster_id: 1, caseName: 'First' }],
          }),
          { status: 200 },
        ),
      );
    }) as typeof fetch;
    const client = new CourtListenerClient({
      timeoutMs: 1000,
      fetchImpl,
      maxPages: 3,
    });
    const found = await client.searchOpinions('"Jane Smith" neurology');
    expect(found.hits.map((hit) => hit.caseName)).toEqual(['First', 'Second']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
