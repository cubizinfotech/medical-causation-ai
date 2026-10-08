import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import {
  applyAiWording,
  AnalysisValidationError,
  validateAiAnalysis,
} from './validate-ai-analysis';
import { buildDeterministicAnalysis } from './deterministic-analysis';
import type { AnalysisPacket, EwiAnalysisRecord } from './ewi-analysis.types';
import type {
  ChallengeCandidate,
  ChallengeReading,
} from '../../research/legal';

/** Excerpt text sent per opinion; keeps the request small for rate-limited models. */
const MAX_EXCERPT_CHARS = 1800;

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
        maxTokens: 8192,
        metadata: {
          product: 'ewi',
          task: 'investigation-analysis',
          responseFormat: 'json',
        },
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
            requiredSections: [
              'expert_summary',
              'credentials',
              'cv_comparison',
              'inconsistencies',
              'legal_matters',
              'orders',
              'motions',
              'depositions',
              'contradictory_testimony',
              'publications',
              'authorship',
              'grants_patents',
              'licenses_certifications',
              'memberships',
              'websites',
              'videos',
              'social_media',
              'income_bias',
              'university_rules',
              'missing_unverified',
              'investigation_findings',
            ],
            evidenceStatuses: [
              'verified',
              'partially_verified',
              'conflicting',
              'not_verified',
              'not_found',
              'unavailable',
              'restricted',
            ],
            minQuestions: 100,
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

  /**
   * Reads Daubert/Frye rulings from opinion excerpts. Returns the model's
   * readings unvalidated; callers keep only readings whose quote appears in
   * the excerpts word for word. Returns [] when no model is available.
   */
  async readChallengeRulings(input: {
    expertName: string;
    surname: string;
    candidates: ChallengeCandidate[];
  }): Promise<ChallengeReading[]> {
    if (input.candidates.length === 0) return [];
    try {
      const provider = this.ai.getActiveLlmProvider();
      if (!provider.isAvailable()) return [];
      const system = await this.ai.loadPrompt('ewi/challenge-rulings-system');
      const response = await this.ai.complete({
        temperature: 0,
        maxTokens: 2048,
        metadata: {
          product: 'ewi',
          task: 'challenge-rulings',
          responseFormat: 'json',
        },
        messages: [{ role: 'system', content: system.content }],
        promptTemplateId: 'ewi/challenge-rulings',
        promptVariables: {
          expertName: input.expertName,
          surname: input.surname,
          itemsJson: JSON.stringify(
            input.candidates.map((candidate) => ({
              id: candidate.id,
              caseName: candidate.caseName,
              court: candidate.court,
              date: candidate.date,
              excerpts: trimExcerpts(candidate.excerpts),
            })),
          ),
        },
      });
      const readings = parseChallengeReadings(response.content);
      this.logger.log(
        `EWI challenge rulings: ${provider.name} read ${readings.length} of ${input.candidates.length} opinion(s); ${readings.filter((reading) => reading.outcome !== 'not_determined').length} proposed an outcome. Only quotes found in the text are kept.`,
      );
      return readings;
    } catch (error) {
      this.logger.warn(
        `EWI challenge rulings were not read: ${error instanceof Error ? error.message : 'AI request failed'}`,
      );
      return [];
    }
  }
}

function trimExcerpts(excerpts: string[]): string[] {
  const kept: string[] = [];
  let used = 0;
  for (const excerpt of excerpts) {
    if (used + excerpt.length > MAX_EXCERPT_CHARS) break;
    kept.push(excerpt);
    used += excerpt.length;
  }
  return kept.length > 0 ? kept : excerpts.slice(0, 1);
}

export function parseChallengeReadings(content: string): ChallengeReading[] {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string') return [];
    return [
      {
        id: row.id,
        role: typeof row.role === 'string' ? row.role : 'unclear',
        outcome:
          typeof row.outcome === 'string' ? row.outcome : 'not_determined',
        quote: typeof row.quote === 'string' ? row.quote : null,
      },
    ];
  });
}
