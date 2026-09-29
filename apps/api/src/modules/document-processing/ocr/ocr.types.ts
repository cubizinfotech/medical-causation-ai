import type { OcrStatus, ProcessedPage } from '../types';

export interface OcrPageInput {
  pageNumber: number;
  /** Existing extractable text (may be empty for scans). */
  existingText: string;
  /** Optional rendered page / image bytes for OCR engines that need pixels. */
  imageBytes?: Buffer;
  mimeType?: string;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  status: OcrStatus;
  warning?: string;
}

export interface OcrDocumentResult {
  pages: OcrPageResult[];
  status: OcrStatus;
  providerName: string;
  warnings: string[];
}

export interface IOcrProvider {
  readonly name: string;
  isAvailable(): boolean;
  recognizePages(pages: OcrPageInput[]): Promise<OcrDocumentResult>;
}

/**
 * Merge OCR page results onto existing PDF pages. Does not invent page numbers.
 */
export function mergeOcrIntoPages(
  pages: ProcessedPage[],
  ocr: OcrDocumentResult,
): ProcessedPage[] {
  const byPage = new Map(ocr.pages.map((page) => [page.pageNumber, page]));
  return pages.map((page) => {
    const ocrPage = byPage.get(page.pageNumber);
    if (!ocrPage) {
      return { ...page, ocrStatus: page.ocrStatus ?? 'skipped' };
    }
    const text =
      ocrPage.status === 'completed' && ocrPage.text.trim()
        ? ocrPage.text
        : page.text;
    return {
      ...page,
      text,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      charCount: text.length,
      ocrStatus: ocrPage.status,
    };
  });
}
