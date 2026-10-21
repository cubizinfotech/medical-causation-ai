import { GeminiGroundedSearchProvider } from './gemini-grounded.provider';
import { SearchProviderError } from '../web-research.types';

describe('GeminiGroundedSearchProvider', () => {
  it('reports not configured without calling Gemini when no API key is set', async () => {
    const provider = new GeminiGroundedSearchProvider(
      undefined,
      'gemini-2.5-flash',
    );
    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.search({ query: 'Jane Doe neurologist', kind: 'web' }, 1000),
    ).rejects.toThrow(/not configured \(no API key\)/i);
    await expect(
      provider.search({ query: 'Jane Doe neurologist', kind: 'web' }, 1000),
    ).rejects.toBeInstanceOf(SearchProviderError);
  });
});
