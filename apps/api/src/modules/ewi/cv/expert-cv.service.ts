import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { RateLimitExceededException } from '@ai/exceptions';
import { BACKGROUND_RATE_LIMIT_RETRY, retryOnRateLimit } from '@ai/utils';
import { ExpertDocumentsService } from '../documents/expert-documents.service';
import {
  buildCvBatches,
  extractBibliographyClaims,
  finalizeCvClaims,
  formatCvBatch,
  parseCvReply,
  validateCvClaims,
} from './cv-claims';
import type { CvClaim, CvExtraction } from './cv.types';

function pageList(pages: number[]): string {
  return [...pages].sort((a, b) => a - b).join(', ');
}

/**
 * Why a CV section is missing, in words the attorney can act on. The page
 * text itself was read; it is the AI step that did not finish.
 */
function sectionFailure(pages: string, error: unknown): string {
  if (error instanceof RateLimitExceededException) {
    return `The AI provider was busy (rate limit) and did not read CV ${pages}. Its claims are missing from the CV check; run the investigation again in a few minutes.`;
  }
  return `The AI model could not finish CV ${pages}. Numbered publications on those pages are still kept. Other statements on those pages are missing from the CV check.`;
}

/**
 * Reads the claims in an uploaded CV with the configured model. Every claim
 * keeps its page and an exact quote; claims the text does not contain are
 * dropped. Never throws for a failed section.
 */
@Injectable()
export class ExpertCvService {
  private readonly logger = new Logger(ExpertCvService.name);

  constructor(
    private readonly ai: AiService,
    private readonly documents: ExpertDocumentsService,
  ) {}

  async extract(
    documentId: string,
    expertName: string,
    onProgress?: (message: string) => Promise<void>,
  ): Promise<CvExtraction | null> {
    const ocr = await this.documents.readScannedPages(
      documentId,
      async (done, total) => {
        await onProgress?.(
          `Reading scanned CV pages with OCR (${done} of ${total})…`,
        );
      },
    );
    const document = await this.documents.loadDocument(documentId);
    if (!document) return null;

    const warnings: string[] = [];
    if (ocr.error) warnings.push(ocr.error);
    if (document.ocrPages.length > 0) {
      warnings.push(
        `${document.ocrPages.length} scanned CV page(s) were read with OCR (${pageList(document.ocrPages)}); check quotes from them against the original.`,
      );
    }
    if (document.unreadablePages.length > 0) {
      warnings.push(
        `${document.unreadablePages.length} CV page(s) had no readable text and were not read: ${pageList(document.unreadablePages)}.`,
      );
    }
    const info = {
      id: document.id,
      name: document.name,
      pageCount: document.pageCount,
      unreadablePages: document.unreadablePages,
      ocrPages: document.ocrPages,
    };

    const batches = buildCvBatches(
      document,
      Math.min(this.documents.batchChars, 5000),
    );
    const listed = extractBibliographyClaims(document.pages);
    if (!this.modelAvailable() || batches.length === 0) {
      warnings.push(
        batches.length === 0
          ? 'The CV has no readable text.'
          : 'No AI model is available to read the CV. Numbered publications on the CV were still kept.',
      );
      return {
        document: info,
        status: listed.length > 0 ? 'partial' : 'failed',
        claims: finalizeCvClaims(listed),
        warnings,
      };
    }

    const system = await this.ai.loadPrompt('ewi/cv-claims-system');
    const drafts: Array<Omit<CvClaim, 'id'>> = [...listed];
    let failed = 0;
    const incomplete = new Set<number>();
    for (const [index, batch] of batches.entries()) {
      const runBatch = () =>
        retryOnRateLimit(
          () =>
            this.ai.complete({
              temperature: 0,
              maxTokens: 8192,
              metadata: {
                product: 'ewi',
                task: 'cv-claims',
                responseFormat: 'json',
              },
              messages: [{ role: 'system', content: system.content }],
              promptTemplateId: 'ewi/cv-claims',
              promptVariables: {
                expertName,
                documentName: document.name,
                pages: formatCvBatch(batch),
              },
            }),
          BACKGROUND_RATE_LIMIT_RETRY,
        );
      try {
        // A free-tier provider often asks to wait; the job waits rather
        // than dropping this part of the CV.
        const response = await runBatch();
        drafts.push(...validateCvClaims(parseCvReply(response.content), batch));
      } catch (error) {
        let recovered = false;
        if (!(error instanceof RateLimitExceededException)) {
          try {
            const retry = await runBatch();
            drafts.push(
              ...validateCvClaims(parseCvReply(retry.content), batch),
            );
            recovered = true;
          } catch {
            recovered = false;
          }
        }
        if (!recovered) {
          failed += 1;
          for (const page of batch.pages) incomplete.add(page.pageNumber);
          const first = batch.pages[0].pageNumber;
          const last = batch.pages[batch.pages.length - 1].pageNumber;
          this.logger.warn(
            `CV section p.${first}-${last} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          warnings.push(
            sectionFailure(
              first === last ? `page ${first}` : `pages ${first}–${last}`,
              error,
            ),
          );
        }
      }
      await onProgress?.(
        `Reading the CV (${index + 1} of ${batches.length} sections)…`,
      );
    }

    const claims = finalizeCvClaims(drafts);
    const incompletePages = [...incomplete].sort((a, b) => a - b);
    if (incompletePages.length > 0) {
      warnings.push(
        `CV page(s) unread or partially extracted: ${pageList(incompletePages)}. Numbered publications on those pages are still kept when they could be parsed. The CV was not fully reviewed.`,
      );
    }
    const unread =
      incompletePages.length > 0 || document.unreadablePages.length > 0;
    this.logger.log(
      `CV ${document.id}: ${claims.length} claim(s) from ${batches.length} section(s)`,
    );
    return {
      document: info,
      status:
        failed === batches.length && claims.length === 0
          ? 'failed'
          : failed > 0 || unread
            ? 'partial'
            : 'completed',
      claims,
      warnings,
      ...(incompletePages.length > 0 ? { incompletePages } : {}),
    };
  }

  private modelAvailable(): boolean {
    try {
      return this.ai.getActiveLlmProvider().isAvailable();
    } catch {
      return false;
    }
  }
}
