import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { MEDICAL_ANALYSIS_PROMPTS } from '../constants';
import { MedicalPromptService } from '../prompts';
import type { MedicalChronology } from '../types';
import type { LoadedCaseRecord } from './case-record.types';
import {
  buildChronologyBatches,
  finalizeChronology,
  formatBatchPages,
  parseChronologyResponse,
  validateChronologyEvents,
  type DraftChronologyEvent,
} from './chronology.helpers';

const SYSTEM_PROMPT =
  'You extract facts from medical records into JSON for legal review. Use only the text you are given. Respond with a single JSON object and nothing else.';

/**
 * Reads uploaded records in batches and builds a cited chronology.
 * Never throws for a failed batch: the pages are listed in the warnings
 * and the analysis continues with what was read.
 */
@Injectable()
export class ChronologyExtractionService {
  private readonly logger = new Logger(ChronologyExtractionService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prompts: MedicalPromptService,
  ) {}

  async build(
    records: LoadedCaseRecord[],
    batchChars: number,
    onProgress?: (done: number, total: number) => Promise<void>,
  ): Promise<MedicalChronology> {
    const warnings: string[] = [];
    for (const record of records) {
      if (record.unreadablePages.length > 0) {
        warnings.push(
          `${record.name}: ${record.unreadablePages.length} of ${record.pageCount} pages have no text layer (scanned or blank) and were not read: ${formatPageList(record.unreadablePages)}.`,
        );
      }
    }

    const batches = buildChronologyBatches(records, batchChars);
    const template = await this.prompts.load(
      MEDICAL_ANALYSIS_PROMPTS.CHRONOLOGY_EXTRACTION,
    );

    const drafts: DraftChronologyEvent[] = [];
    let failed = 0;
    for (const [index, batch] of batches.entries()) {
      const first = batch.pages[0].pageNumber;
      const last = batch.pages[batch.pages.length - 1].pageNumber;
      try {
        const response = await this.aiService.complete({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: this.prompts.render(template, {
                documentName: batch.documentName,
                pages: formatBatchPages(batch),
              }),
            },
          ],
          metadata: { responseFormat: 'json' },
          temperature: 0,
        });
        drafts.push(
          ...validateChronologyEvents(
            parseChronologyResponse(response.content),
            batch,
          ),
        );
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Chronology batch failed (${batch.documentName} p.${first}-${last}): ${reason}`,
        );
        warnings.push(
          `${batch.documentName}: pages ${first === last ? first : `${first}–${last}`} could not be processed and are missing from the chronology.`,
        );
      }
      await onProgress?.(index + 1, batches.length);
    }

    const events = finalizeChronology(
      drafts,
      records.map((record) => record.id),
    );
    const unverified = events.filter((event) => !event.quoteVerified).length;
    if (unverified > 0) {
      warnings.push(
        `${unverified} entr${unverified === 1 ? 'y' : 'ies'} could not be matched to the exact text of the cited page. Check those pages before relying on them.`,
      );
    }

    return {
      status:
        batches.length === 0 || failed === batches.length
          ? 'failed'
          : failed > 0
            ? 'partial'
            : 'completed',
      documents: records.map((record) => ({
        recordId: record.id,
        documentName: record.name,
        pageCount: record.pageCount,
        unreadablePages: record.unreadablePages,
      })),
      events,
      pagesProcessed: batches.reduce((sum, b) => sum + b.pages.length, 0),
      warnings,
      generatedAt: new Date().toISOString(),
    };
  }
}

/** [1,2,3,7,9,10] -> "1–3, 7, 9–10" */
export function formatPageList(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}–${sorted[i]}`);
  }
  return ranges.join(', ');
}
