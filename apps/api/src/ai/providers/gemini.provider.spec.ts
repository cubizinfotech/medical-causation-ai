import {
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import { GeminiProvider } from './gemini.provider';
import { GeminiEmbeddingProvider } from './embeddings/gemini-embedding.provider';

const generateContent = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
const embedContent = jest.fn<Promise<unknown>, [Record<string, unknown>]>();

jest.mock('@ai/utils/gemini-client.util', () => ({
  createGeminiClient: () => ({ models: { generateContent, embedContent } }),
}));

function apiError(status: number, message: string): Error {
  const error = new Error(
    JSON.stringify({ error: { code: status, message } }),
  ) as Error & { status: number };
  error.status = status;
  return error;
}

const settings = {
  apiKey: 'test-key',
  baseUrl: '',
  organization: undefined,
} as never;

describe('GeminiProvider', () => {
  const request = {
    messages: [
      { role: 'system' as const, content: 'System' },
      { role: 'user' as const, content: 'Question' },
    ],
    model: 'gemini-test',
    maxTokens: 8192,
    metadata: { responseFormat: 'json' as const },
  };

  beforeEach(() => generateContent.mockReset());

  it('returns the text with its finish reason and usage', async () => {
    generateContent.mockResolvedValue({
      text: '{"ok":true}',
      modelVersion: 'gemini-test-001',
      candidates: [{ finishReason: 'MAX_TOKENS' }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    });
    const provider = new GeminiProvider(settings, {
      timeoutMs: 1000,
      maxRetries: 1,
      retryDelayMs: 1,
    });

    const response = await provider.complete(request);

    expect(response).toMatchObject({
      content: '{"ok":true}',
      finishReason: 'MAX_TOKENS',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const sent = generateContent.mock.calls[0][0] as {
      config: { maxOutputTokens: number; responseMimeType: string };
    };
    expect(sent.config.maxOutputTokens).toBe(8192);
    expect(sent.config.responseMimeType).toBe('application/json');
  });

  it('does not resend a request that cannot succeed (bad key)', async () => {
    generateContent.mockRejectedValue(apiError(400, 'API key not valid.'));
    const provider = new GeminiProvider(settings, {
      timeoutMs: 1000,
      maxRetries: 3,
      retryDelayMs: 1,
    });

    const error = (await provider
      .complete(request)
      .catch((e: unknown) => e)) as ProviderUnavailableException;
    expect(error).toBeInstanceOf(ProviderUnavailableException);
    expect(error.failure).toBe('auth');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries an overloaded model once even with one configured attempt', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(503, 'The model is overloaded.'))
      .mockResolvedValueOnce({
        text: 'ok',
        candidates: [{ finishReason: 'STOP' }],
      });
    const provider = new GeminiProvider(settings, {
      timeoutMs: 1000,
      maxRetries: 1,
      retryDelayMs: 1,
    });

    await expect(provider.complete(request)).resolves.toMatchObject({
      content: 'ok',
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('reports rate limits so the caller can wait or use the fallback provider', async () => {
    generateContent.mockRejectedValue(
      apiError(429, 'RESOURCE_EXHAUSTED. Please retry in 7s.'),
    );
    const provider = new GeminiProvider(settings, {
      timeoutMs: 1000,
      maxRetries: 1,
      retryDelayMs: 1,
    });

    await expect(provider.complete(request)).rejects.toMatchObject({
      retryAfterMs: 7000,
      quotaExhausted: false,
    });
    await expect(provider.complete(request)).rejects.toBeInstanceOf(
      RateLimitExceededException,
    );
  });
});

describe('GeminiEmbeddingProvider', () => {
  const savedEnv = {
    batch: process.env.GEMINI_EMBED_BATCH_SIZE,
    delay: process.env.GEMINI_EMBED_ITEM_DELAY_MS,
  };

  beforeEach(() => {
    embedContent.mockReset();
    embedContent.mockImplementation(({ contents }: { contents: unknown[] }) =>
      Promise.resolve({
        embeddings: contents.map((_, i) => ({ values: [i, 1, 0] })),
      }),
    );
    delete process.env.GEMINI_EMBED_BATCH_SIZE;
    process.env.GEMINI_EMBED_ITEM_DELAY_MS = '0';
  });

  afterAll(() => {
    for (const [name, value] of [
      ['GEMINI_EMBED_BATCH_SIZE', savedEnv.batch],
      ['GEMINI_EMBED_ITEM_DELAY_MS', savedEnv.delay],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const runtime = {
    timeoutMs: 1000,
    maxRetries: 5,
    retryDelayMs: 1,
    dimensions: 3,
  };

  const inputs = Array.from({ length: 150 }, (_, i) => ({
    id: `c${i}`,
    text: `text ${i}`,
  }));

  it('sends 16 texts per call by default', async () => {
    const provider = new GeminiEmbeddingProvider(settings, runtime);

    const response = await provider.embed({
      inputs,
      model: 'gemini-embedding-2',
    });

    expect(embedContent).toHaveBeenCalledTimes(10);
    expect(response.results).toHaveLength(150);
  });

  it('never sends more than the API limit of 100 per call', async () => {
    process.env.GEMINI_EMBED_BATCH_SIZE = '500';
    const provider = new GeminiEmbeddingProvider(settings, runtime);

    await provider.embed({ inputs, model: 'gemini-embedding-2' });

    expect(embedContent).toHaveBeenCalledTimes(2);
  });

  it('embeds many texts per call, one Content object per text', async () => {
    process.env.GEMINI_EMBED_BATCH_SIZE = '100';
    const provider = new GeminiEmbeddingProvider(settings, runtime);

    const response = await provider.embed({
      inputs,
      model: 'gemini-embedding-2',
    });

    // 150 texts: two calls of at most 100.
    expect(embedContent).toHaveBeenCalledTimes(2);
    const first = embedContent.mock.calls[0][0] as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(first.contents).toHaveLength(100);
    expect(first.contents[0]).toEqual({
      role: 'user',
      parts: [{ text: 'text 0' }],
    });
    expect(response.results).toHaveLength(150);
    expect(response.results[149]).toMatchObject({ id: 'c149', dimensions: 3 });
  });

  it('refuses a reply whose vector count does not match the inputs', async () => {
    embedContent.mockResolvedValue({ embeddings: [{ values: [1, 2, 3] }] });
    const provider = new GeminiEmbeddingProvider(settings, runtime);

    await expect(
      provider.embed({
        inputs: [{ text: 'a' }, { text: 'b' }],
        model: 'gemini-embedding-2',
      }),
    ).rejects.toThrow(/1 embedding\(s\) for 2 input/);
  });

  it('honours a caller cap on retries for a waiting search', async () => {
    embedContent.mockRejectedValue(apiError(503, 'overloaded'));
    const provider = new GeminiEmbeddingProvider(settings, runtime);

    await expect(
      provider.embed({ inputs: [{ text: 'q' }], maxAttempts: 2 }),
    ).rejects.toBeInstanceOf(ProviderUnavailableException);
    expect(embedContent).toHaveBeenCalledTimes(2);
  });
});
