import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { retryOnRateLimit } from '@ai/utils';
import { MEDICAL_ANALYSIS_PROMPTS } from '../constants';
import { MedicalPromptService } from '../prompts';
import { formatChronologyForPrompt } from '../records/chronology.helpers';
import { AnalysisHistoryService } from '../services/analysis-history.service';
import type { ChronologyEvent } from '../types';
import type { CreateDemandLetterDto } from './create-demand-letter.dto';
import { buildDemandLetterContent } from './demand-letter.content';
import { renderDemandLetter } from './demand-letter.docx';
import { formatEventDateLong, slugify } from './letter-format';
import {
  checkNarrative,
  chronologyNarrative,
  parseNarrative,
  renderCitations,
} from './treatment-narrative';

const SYSTEM_PROMPT =
  'You draft sections of legal correspondence from summaries of medical records. Use only the facts you are given. Respond with a single JSON object and nothing else.';

/** Characters of chronology given to the treatment prompt. */
const CHRONOLOGY_CHARS = 12000;

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface DemandLetterFile {
  fileName: string;
  buffer: Buffer;
  /** ai: drafted from the chronology and checked; chronology: the entries listed. */
  treatmentSource: 'ai' | 'chronology' | 'none';
}

/**
 * Drafts a settlement demand letter (Word) from a finished analysis: the
 * cited chronology, the bills summary, and what the attorney enters.
 */
@Injectable()
export class DemandLetterService {
  private readonly logger = new Logger(DemandLetterService.name);

  constructor(
    private readonly history: AnalysisHistoryService,
    private readonly aiService: AiService,
    private readonly prompts: MedicalPromptService,
  ) {}

  async build(
    id: string,
    ownerUserId: string,
    dto: CreateDemandLetterDto,
    today = new Date().toISOString().slice(0, 10),
  ): Promise<DemandLetterFile> {
    const detail = await this.history.getHistory(id, ownerUserId);
    if (detail.status !== 'completed' || !detail.result) {
      throw new BadRequestException(
        'The analysis must finish before a demand letter can be drafted.',
      );
    }
    const dateOfLoss = dto.dateOfLoss ?? detail.accidentDate;
    const treatment = await this.treatment(
      detail.result.chronology?.events ?? [],
      dto,
      dateOfLoss,
      [detail.diagnosis, detail.accidentType],
    );
    const content = buildDemandLetterContent({
      dto,
      accidentDate: detail.accidentDate,
      result: detail.result,
      treatment: treatment.paragraphs,
      today,
    });
    return {
      fileName: `demand-letter-${slugify(dto.clientName)}-${today}.docx`,
      buffer: await renderDemandLetter(content),
      treatmentSource: treatment.source,
    };
  }

  /**
   * The "Injuries and Treatment" paragraphs. The AI draft is used only when
   * every sentence cites an entry and its dates and codes are in the
   * entries; otherwise the entries are listed as they are.
   */
  private async treatment(
    events: ChronologyEvent[],
    dto: CreateDemandLetterDto,
    dateOfLoss: string,
    focusTerms: string[],
  ): Promise<{
    paragraphs: string[];
    source: DemandLetterFile['treatmentSource'];
  }> {
    if (events.length === 0) return { paragraphs: [], source: 'none' };
    if (dto.useAi !== false) {
      try {
        const prompt = formatChronologyForPrompt(
          events,
          CHRONOLOGY_CHARS,
          focusTerms,
        );
        const shown = events.filter((event) =>
          prompt.includedIds.includes(event.id),
        );
        const template = await this.prompts.load(
          MEDICAL_ANALYSIS_PROMPTS.DEMAND_LETTER_TREATMENT,
        );
        const response = await retryOnRateLimit(() =>
          this.aiService.complete({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: this.prompts.render(template, {
                  clientName: dto.clientName.trim(),
                  dateOfLoss: /^\d{4}-\d{2}-\d{2}$/.test(dateOfLoss)
                    ? formatEventDateLong(dateOfLoss)
                    : dateOfLoss || 'not stated',
                  chronology: prompt.text,
                }),
              },
            ],
            metadata: { responseFormat: 'json' },
            temperature: 0.2,
            maxTokens: 4096,
          }),
        );
        const draft = parseNarrative(response.content);
        const check = checkNarrative(draft, shown, dateOfLoss);
        if (check.ok) {
          const byId = new Map(shown.map((event) => [event.id, event]));
          return {
            paragraphs: draft.map((text) => renderCitations(text, byId)),
            source: 'ai',
          };
        }
        this.logger.warn(`Demand letter draft not used: ${check.reason}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Demand letter draft failed: ${reason}`);
      }
    }
    return { paragraphs: chronologyNarrative(events), source: 'chronology' };
  }
}
