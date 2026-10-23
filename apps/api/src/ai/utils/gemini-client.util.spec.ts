import {
  resolveGeminiApiKey,
  resolveGeminiEmbeddingModel,
  usableGeminiApiKey,
} from './gemini-client.util';

describe('usableGeminiApiKey', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation();

  afterEach(() => {
    warn.mockClear();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  afterAll(() => {
    warn.mockRestore();
  });

  it('keeps a full Gemini or Google AI key', () => {
    expect(usableGeminiApiKey('AQ.' + 'x'.repeat(40))).toMatch(/^AQ\./);
    expect(usableGeminiApiKey('AIza' + 'y'.repeat(35))).toMatch(/^AIza/);
  });

  it('drops a truncated key that lost the leading A', () => {
    expect(usableGeminiApiKey('Q.' + 'x'.repeat(40))).toBeUndefined();
    expect(usableGeminiApiKey('short')).toBeUndefined();
    expect(usableGeminiApiKey('')).toBeUndefined();
  });

  it('does not resolve a truncated env key for Gemini clients', () => {
    process.env.GEMINI_API_KEY = 'Q.' + 'x'.repeat(40);
    expect(resolveGeminiApiKey()).toBe('');
  });
});

describe('resolveGeminiEmbeddingModel', () => {
  const fallback = 'gemini-embedding-2';

  it('keeps a Gemini embedding model', () => {
    expect(
      resolveGeminiEmbeddingModel('gemini-embedding-001', fallback),
    ).toEqual({ model: 'gemini-embedding-001', replaced: false });
  });

  it('uses the embedding default when the chat model was copied into the embedding setting', () => {
    expect(
      resolveGeminiEmbeddingModel('gemini-3.5-flash-lite', fallback),
    ).toEqual({ model: fallback, replaced: true });
  });

  it('uses the embedding default when nothing is configured', () => {
    expect(resolveGeminiEmbeddingModel('  ', fallback)).toEqual({
      model: fallback,
      replaced: false,
    });
  });
});
