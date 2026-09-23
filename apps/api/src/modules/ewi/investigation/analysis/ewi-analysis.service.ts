import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import {
  applyAiWording,
  AnalysisValidationError,
  validateAiAnalysis,
} from './validate-ai-analysis';
import { buildDeterministicAnalysis } from './deterministic-analysis';
import type { AnalysisPacket, EwiAnalysisRecord } from './ewi-analysis.types';

@Injectable()
export class EwiAnalysisService {
  private readonly logger = new Logger(EwiAnalysisService.name);

  constructor(private readonly ai: AiService) {}

  /**
   * Source-derived structure is always kept. Model wording is saved only
   * after it validates against the collected packet.
   */
  async interpret(packet: AnalysisPacket): Promise<EwiAnalysisRecord> {
    const deterministic = buildDeterministicAnalysis(packet);
    try {
      const provider = this.ai.getActiveLlmProvider();
      if (!provider.isAvailable()) {
        this.logger.log(
          'Active LLM is unavailable. EWI analysis uses collected findings only.',
        );
        return {
          origin: 'deterministic',
          providerName: null,
          document: deterministic,
        };
      }

      const system = await this.ai.loadPrompt(
        'ewi/investigation-analysis-system',
      );
      const response = await this.ai.complete({
        temperature: 0,
        maxTokens: 1200,
        metadata: { product: 'ewi', task: 'investigation-analysis' },
        messages: [{ role: 'system', content: system.content }],
        promptTemplateId: 'ewi/investigation-analysis',
        promptVariables: {
          expertName: packet.expertName,
          specialty: packet.specialty,
          findingsJson: JSON.stringify({
            findings: packet.findings.map((finding) => ({
              findingKey: finding.findingKey,
              category: finding.category,
              title: finding.title,
              summary: finding.summary,
              url: finding.url,
              providerId: finding.providerId,
              informationStatus: finding.informationStatus,
              access: finding.access,
            })),
            sourceAttempts: packet.sourceAttempts,
          }),
        },
      });
      const wording = validateAiAnalysis(response.content, packet);
      this.logger.log(
        `EWI analysis wording accepted from ${provider.name}. Source assessments were kept.`,
      );
      return {
        origin: 'ai',
        providerName: provider.name,
        document: applyAiWording(deterministic, wording),
      };
    } catch (error) {
      const message =
        error instanceof AnalysisValidationError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'AI analysis failed';
      this.logger.warn(
        `EWI analysis discarded model output and kept collected findings: ${message}`,
      );
      return {
        origin: 'deterministic',
        providerName: null,
        document: deterministic,
      };
    }
  }
}
