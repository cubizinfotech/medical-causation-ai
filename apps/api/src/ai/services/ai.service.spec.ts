import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@config/configuration';
import { AiModule } from '@ai/ai.module';
import { AiService } from '@ai/services';
import { LlmProviderFactory } from '@ai/providers';
import {
  InvalidPromptException,
  RateLimitExceededException,
} from '@ai/exceptions';

describe('AiService', () => {
  let aiService: AiService;
  let llmProviderFactory: LlmProviderFactory;
  let previousProvider: string | undefined;

  beforeEach(async () => {
    previousProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'openrouter';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          // Re-evaluate env for this suite so local .env AI_PROVIDER does not flake tests.
          ignoreEnvFile: true,
        }),
        AiModule,
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
    llmProviderFactory = module.get<LlmProviderFactory>(LlmProviderFactory);
  });

  afterEach(() => {
    if (previousProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = previousProvider;
    }
  });

  it('should be defined', () => {
    expect(aiService).toBeDefined();
  });

  it('should return active LLM provider based on config', () => {
    const provider = aiService.getActiveLlmProvider();
    expect(provider.name).toBe('openrouter');
  });

  it('should return provider status for all providers', () => {
    const status = aiService.getLlmProviderStatus();
    expect(status.length).toBeGreaterThanOrEqual(1);
    expect(status.find((s) => s.active)?.name).toBe('openrouter');
  });

  it('should resolve default model for active provider', () => {
    const provider = llmProviderFactory.getActiveProvider();
    const model = llmProviderFactory.resolveModel(provider);
    expect(model).toBeTruthy();
  });
});

describe('AiService fallback provider', () => {
  function build(fallback: string | null, primaryError?: Error) {
    const response = (provider: string) => ({
      content: '{}',
      model: `${provider}-model`,
      provider,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
    const primary = {
      name: 'mistral',
      isAvailable: () => true,
      complete: jest.fn(() =>
        primaryError
          ? Promise.reject(primaryError)
          : Promise.resolve(response('mistral')),
      ),
    };
    const backup = {
      name: 'gemini',
      isAvailable: () => true,
      complete: jest.fn(() => Promise.resolve(response('gemini'))),
    };
    const factory = {
      getActiveProvider: () => primary,
      getProvider: (name: string) => (name === 'gemini' ? backup : primary),
      resolveModel: (provider: { name: string }, model?: string) =>
        model ?? `${provider.name}-default`,
    };
    const config = {
      fallbackLlmProvider: fallback,
      temperature: 0,
      maxTokens: 100,
      token: { maxPromptTokens: 100_000 },
    };
    const service = new AiService(
      config as never,
      factory as never,
      {} as never,
      {} as never,
    );
    return { service, primary, backup };
  }
  const options = { messages: [{ role: 'user' as const, content: 'hi' }] };

  it('sends the request to the fallback when the provider refuses it', async () => {
    const { service, backup } = build(
      'gemini',
      new RateLimitExceededException('mistral', 20_000),
    );
    const result = await service.complete({ ...options, model: 'mistral-x' });
    expect(result.provider).toBe('gemini');
    // The primary's model name is not passed to another provider.
    expect(backup.complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-default' }),
    );
  });

  it('uses only the active provider when it answers', async () => {
    const { service, backup } = build('gemini');
    expect((await service.complete(options)).provider).toBe('mistral');
    expect(backup.complete).not.toHaveBeenCalled();
  });

  it('does not hide other errors or run without a fallback', async () => {
    const limited = new RateLimitExceededException('mistral', 1);
    await expect(build(null, limited).service.complete(options)).rejects.toBe(
      limited,
    );
    const invalid = new InvalidPromptException('bad prompt');
    await expect(
      build('gemini', invalid).service.complete(options),
    ).rejects.toBe(invalid);
  });
});
