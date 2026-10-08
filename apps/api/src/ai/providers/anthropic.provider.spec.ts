import {
  InvalidModelException,
  ProviderUnavailableException,
  RateLimitExceededException,
} from '@ai/exceptions';
import { AnthropicProvider } from './anthropic.provider';

const mockStream = jest.fn<
  { finalMessage: () => Promise<unknown> },
  [Record<string, unknown>]
>();
const mockClientOptions = jest.fn<void, [Record<string, unknown>]>();

jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    constructor(
      readonly status?: number,
      readonly headers?: Headers,
    ) {
      super(`status ${status}`);
    }
  }
  class RateLimitError extends APIError {}
  class NotFoundError extends APIError {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static NotFoundError = NotFoundError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    beta = { messages: { stream: mockStream } };
    constructor(options: Record<string, unknown>) {
      mockClientOptions(options);
    }
  }
  return { __esModule: true, default: Anthropic };
});

interface MockSdk {
  default: {
    RateLimitError: new (status?: number, headers?: Headers) => Error;
    NotFoundError: new (status?: number) => Error;
  };
}
const { default: MockAnthropic } =
  jest.requireMock<MockSdk>('@anthropic-ai/sdk');

function message(overrides: Record<string, unknown> = {}) {
  return {
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    stop_details: null,
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '{"ok":' },
      { type: 'text', text: 'true}' },
    ],
    usage: { input_tokens: 100, output_tokens: 20 },
    ...overrides,
  };
}

function respondWith(value: unknown) {
  mockStream.mockReturnValue({
    finalMessage: () =>
      value instanceof Error ? Promise.reject(value) : Promise.resolve(value),
  });
}

function provider(baseUrl = 'https://api.anthropic.com', workspaceId?: string) {
  return new AnthropicProvider(
    {
      apiKey: 'test-key',
      baseUrl,
      effort: 'high',
      minMaxTokens: 32000,
      workspaceId,
    },
    { timeoutMs: 1000, maxRetries: 3, retryDelayMs: 0 },
  );
}

const baseRequest = {
  messages: [
    { role: 'system' as const, content: 'You are careful.' },
    { role: 'user' as const, content: 'Analyze.' },
  ],
  temperature: 0.2,
  maxTokens: 3000,
  metadata: { responseFormat: 'json' },
};

describe('AnthropicProvider', () => {
  beforeEach(() => {
    mockStream.mockReset();
    mockClientOptions.mockReset();
  });

  it('sends current-generation request shape for Claude Opus 5.5', async () => {
    respondWith(message());
    const result = await provider().complete({
      ...baseRequest,
      model: 'claude-opus-5-5',
    });

    const params = mockStream.mock.calls[0][0];
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: 'Analyze.' }],
    });
    expect(params).not.toHaveProperty('temperature');
    expect(params.system).toContain('You are careful.');
    expect(params.system).toContain('single valid JSON object');
    expect(result.content).toBe('{"ok":true}');
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
    });
  });

  it('keeps temperature and skips thinking for older models', async () => {
    respondWith(message({ model: 'claude-haiku-4-5' }));
    await provider().complete({ ...baseRequest, model: 'claude-haiku-4-5' });

    const params = mockStream.mock.calls[0][0];
    expect(params).toMatchObject({ temperature: 0.2, max_tokens: 3000 });
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('output_config');
    expect(params).not.toHaveProperty('fallbacks');
  });

  it('does not send server-side fallbacks through a custom base URL', async () => {
    respondWith(message());
    await provider('https://proxy.example.com').complete({
      ...baseRequest,
      model: 'claude-opus-5-5',
    });
    expect(mockStream.mock.calls[0][0]).not.toHaveProperty('fallbacks');
  });

  it('sends the workspace header only when ANTHROPIC_WORKSPACE_ID is set', async () => {
    respondWith(message());
    await provider('https://api.anthropic.com', 'wrkspc_test').complete({
      ...baseRequest,
      model: 'claude-opus-5-5',
    });
    expect(mockClientOptions.mock.calls[0][0]).toMatchObject({
      apiKey: 'test-key',
      maxRetries: 2,
      defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_test' },
    });

    respondWith(message());
    await provider().complete({ ...baseRequest, model: 'claude-opus-5-5' });
    expect(mockClientOptions.mock.calls[1][0]).not.toHaveProperty(
      'defaultHeaders',
    );
  });

  it('throws on a refusal instead of returning partial text', async () => {
    respondWith(
      message({
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'bio' },
      }),
    );
    await expect(
      provider().complete({ ...baseRequest, model: 'claude-opus-5-5' }),
    ).rejects.toThrow('Claude declined this request (category: bio)');
  });

  it('throws when the answer was cut off at max_tokens', async () => {
    respondWith(message({ stop_reason: 'max_tokens' }));
    await expect(
      provider().complete({ ...baseRequest, model: 'claude-opus-5-5' }),
    ).rejects.toBeInstanceOf(ProviderUnavailableException);
  });

  it('maps SDK errors to AI exceptions', async () => {
    respondWith(
      new MockAnthropic.RateLimitError(
        429,
        new Headers({ 'retry-after': '7' }),
      ),
    );
    const rateLimited = provider()
      .complete({ ...baseRequest, model: 'claude-opus-5-5' })
      .catch((error: unknown) => error);
    expect(await rateLimited).toBeInstanceOf(RateLimitExceededException);
    expect((await rateLimited) as RateLimitExceededException).toMatchObject({
      retryAfterMs: 7000,
    });

    respondWith(new MockAnthropic.NotFoundError(404));
    await expect(
      provider().complete({ ...baseRequest, model: 'claude-unknown' }),
    ).rejects.toBeInstanceOf(InvalidModelException);
  });
});
