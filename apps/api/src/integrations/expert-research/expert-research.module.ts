import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModule } from '@ai/ai.module';
import { AiService } from '@ai/services/ai.service';
import type { ResearchProviderSettings } from '@config/config.types';
import type { WebResearchLlm } from '../web-research/web-research.types';
import {
  createCatalogProviders,
  createExpertResearchRuntime,
  createPublicationLookup,
  ExpertResearchService,
} from './expert-research.service';

/** Text-in, text-out model call for reading web pages (never creative). */
export function webResearchLlmFrom(ai: AiService): WebResearchLlm {
  return async ({ system, user, maxTokens }) => {
    const response = await ai.complete({
      temperature: 0,
      maxTokens,
      metadata: {
        product: 'ewi',
        task: 'web-page-classification',
        responseFormat: 'json',
      },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return response.content;
  };
}

@Module({
  imports: [AiModule],
  providers: [
    {
      provide: ExpertResearchService,
      useFactory: (config: ConfigService, ai: AiService) => {
        const runtime = createExpertResearchRuntime(
          config.get<ResearchProviderSettings>('research'),
          { webLlm: webResearchLlmFrom(ai) },
        );
        return new ExpertResearchService(
          createCatalogProviders(runtime),
          createPublicationLookup(runtime),
          runtime.live?.webEngine ?? null,
        );
      },
      inject: [ConfigService, AiService],
    },
  ],
  exports: [ExpertResearchService],
})
export class ExpertResearchIntegrationsModule {}
