import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@config/configuration';
import { AiModule } from '@ai/ai.module';
import { AiService } from '@ai/services';
import { LlmProviderFactory } from '@ai/providers';
import { LLM_PROVIDERS } from '@ai/constants';

describe('AiService', () => {
  let aiService: AiService;
  let llmProviderFactory: LlmProviderFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [configuration] }), AiModule],
    }).compile();

    aiService = module.get<AiService>(AiService);
    llmProviderFactory = module.get<LlmProviderFactory>(LlmProviderFactory);
  });

  it('should be defined', () => {
    expect(aiService).toBeDefined();
  });

  it('should return active LLM provider based on config', () => {
    const provider = aiService.getActiveLlmProvider();
    expect(provider.name).toBe(LLM_PROVIDERS.OPENROUTER);
  });

  it('should return provider status for all providers', () => {
    const status = aiService.getLlmProviderStatus();
    expect(status.length).toBe(5);
    expect(status.find((s) => s.active)?.name).toBe(LLM_PROVIDERS.OPENROUTER);
  });

  it('should resolve default model for active provider', () => {
    const provider = llmProviderFactory.getActiveProvider();
    const model = llmProviderFactory.resolveModel(provider);
    expect(model).toBeTruthy();
  });
});
