import { resolveGeminiEmbeddingModel } from './gemini-client.util';

describe('resolveGeminiEmbeddingModel', () => {
  const fallback = 'gemini-embedding-2';

  it('keeps a Gemini embedding model', () => {
    expect(resolveGeminiEmbeddingModel('gemini-embedding-001', fallback)).toEqual(
      { model: 'gemini-embedding-001', replaced: false },
    );
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
