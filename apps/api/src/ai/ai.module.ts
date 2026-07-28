import { Module } from '@nestjs/common';
import { AppConfigModule } from '@config/config.module';
import { AiConfigService } from '@ai/config';
import { LlmProviderFactory, EmbeddingProviderFactory } from '@ai/providers';
import { AiService, PromptService } from '@ai/services';

@Module({
  imports: [AppConfigModule],
  providers: [
    AiConfigService,
    LlmProviderFactory,
    EmbeddingProviderFactory,
    PromptService,
    AiService,
  ],
  exports: [AiService, PromptService, AiConfigService],
})
export class AiModule {}
