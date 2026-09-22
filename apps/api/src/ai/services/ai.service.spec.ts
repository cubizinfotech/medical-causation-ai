import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@config/configuration';
import { AiModule } from '@ai/ai.module';
import { AiService } from '@ai/services';
import { LlmProviderFactory } from '@ai/providers';

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
