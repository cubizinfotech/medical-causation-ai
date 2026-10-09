import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@ai/services';
import { ExpertDocumentsService } from '../documents/expert-documents.service';
import {
  buildCvBatches,
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

    const batches = buildCvBatches(document, this.documents.batchChars);
    if (!this.modelAvailable() || batches.length === 0) {
      warnings.push(
        batches.length === 0
          ? 'The CV has no readable text.'
          : 'No AI model is available to read the CV, so its claims were not compared.',
      );
      return { document: info, status: 'failed', claims: [], warnings };
    }

    const system = await this.ai.loadPrompt('ewi/cv-claims-system');
    const drafts: Array<Omit<CvClaim, 'id'>> = [];
    let failed = 0;
    for (const [index, batch] of batches.entries()) {
      try {
        const response = await this.ai.complete({
          temperature: 0,
          maxTokens: 4096,
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
        });
        drafts.push(...validateCvClaims(parseCvReply(response.content), batch));
      } catch (error) {
        failed += 1;
        const first = batch.pages[0].pageNumber;
        const last = batch.pages[batch.pages.length - 1].pageNumber;
        this.logger.warn(
          `CV section p.${first}-${last} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        warnings.push(
          `CV pages ${first === last ? first : `${first}–${last}`} could not be read and are missing from the CV check.`,
        );
      }
      await onProgress?.(
        `Reading the CV (${index + 1} of ${batches.length} sections)…`,
      );
    }

    const claims = finalizeCvClaims(drafts);
    this.logger.log(
      `CV ${document.id}: ${claims.length} claim(s) from ${batches.length} section(s)`,
    );
    return {
      document: info,
      status:
        failed === batches.length
          ? 'failed'
          : failed > 0
            ? 'partial'
            : 'completed',
      claims,
      warnings,
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
