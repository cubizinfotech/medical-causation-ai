import { Injectable } from '@nestjs/common';
import type {
  IOcrProvider,
  OcrDocumentResult,
  OcrPageInput,
} from './ocr.types';

/**
 * Used when OCR is disabled or no engine is configured.
 * Marks OCR as failed rather than inventing text.
 */
@Injectable()
export class DisabledOcrProvider implements IOcrProvider {
  readonly name = 'disabled';

  isAvailable(): boolean {
    return false;
  }

  recognizePages(pages: OcrPageInput[]): Promise<OcrDocumentResult> {
    return Promise.resolve({
      providerName: this.name,
      status: 'failed',
      warnings: [
        'OCR provider is disabled or unavailable. Scanned document text was not extracted.',
      ],
      pages: pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.existingText,
        status: 'failed' as const,
        warning: 'OCR not available',
      })),
    });
  }
}
