import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { retryOnRateLimit } from '@ai/utils';
import { MEDICAL_ANALYSIS_PROMPTS } from '../constants';
import { MedicalPromptService } from '../prompts';
import type { ChronologyEvent, MedicalSpecials } from '../types';
import type { LoadedCaseRecord } from './case-record.types';
import { formatBatchPages } from './chronology.helpers';
import {
  BILLING_BATCH_CHARS,
  billPagesOf,
  buildBillingBatches,
  finalizeSpecials,
  parseBillingResponse,
  validateBilling,
  type DraftBilling,
} from './billing.helpers';

const SYSTEM_PROMPT =
  'You extract facts from medical bills into JSON for legal review. Use only the text you are given. Respond with a single JSON object and nothing else.';

/** Room for the lines of one dense bill page. */
const BILLING_MAX_TOKENS = 8192;

/**
 * Reads the pages of the uploaded records that look like bills into a ledger
 * of charges, each cited to its page. Never throws for a failed batch: the
 * pages are listed in the warnings and the ledger keeps what was read.
 */
@Injectable()
export class BillingExtractionService {
  private readonly logger = new Logger(BillingExtractionService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prompts: MedicalPromptService,
  ) {}

  async build(
    records: LoadedCaseRecord[],
    events: ChronologyEvent[] = [],
    onProgress?: (done: number, total: number) => Promise<void>,
  ): Promise<MedicalSpecials> {
    const batches = buildBillingBatches(records, BILLING_BATCH_CHARS);
    const template =
      batches.length > 0
        ? await this.prompts.load(MEDICAL_ANALYSIS_PROMPTS.BILLING_EXTRACTION)
        : '';

    const drafts: DraftBilling[] = [];
    const warnings: string[] = [];
    let failed = 0;
    let truncated = false;
    for (const [index, batch] of batches.entries()) {
      const first = batch.pages[0].pageNumber;
      const last = batch.pages[batch.pages.length - 1].pageNumber;
      const pages = first === last ? `page ${first}` : `pages ${first}–${last}`;
      try {
        const response = await retryOnRateLimit(() =>
          this.aiService.complete({
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
            maxTokens: BILLING_MAX_TOKENS,
          }),
        );
        const raw = parseBillingResponse(response.content);
        if (raw.truncated) {
          truncated = true;
          warnings.push(
            `${batch.documentName}: the reply for ${pages} was cut off; some charges on ${first === last ? 'that page' : 'those pages'} may be missing.`,
          );
        }
        drafts.push(validateBilling(raw, batch));
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Billing batch failed (${batch.documentName} ${pages}): ${reason}`,
        );
        warnings.push(
          `${batch.documentName}: ${pages} could not be read for charges and ${first === last ? 'is' : 'are'} missing from the bills summary.`,
        );
      }
      await onProgress?.(index + 1, batches.length);
    }

    return finalizeSpecials({
      drafts,
      records,
      billPages: billPagesOf(batches),
      events,
      warnings,
      failedBatches: failed,
      totalBatches: batches.length,
      truncated,
    });
  }
}
