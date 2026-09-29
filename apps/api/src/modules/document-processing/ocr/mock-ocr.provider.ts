import { Injectable } from '@nestjs/common';
import type {
  IOcrProvider,
  OcrDocumentResult,
  OcrPageInput,
} from './ocr.types';

/**
 * Deterministic OCR stand-in for tests and local development.
 * Returns supplied fixture text; never invents Bates or page numbers.
 */
@Injectable()
export class MockOcrProvider implements IOcrProvider {
  readonly name = 'mock';

  private fixtureByPage = new Map<number, string>();
  private failNext = false;

  isAvailable(): boolean {
    return true;
  }

  /** Test helper: seed OCR text for a page. */
  setPageText(pageNumber: number, text: string): void {
    this.fixtureByPage.set(pageNumber, text);
  }

  /** Test helper: force the next recognizePages call to fail. */
  setFailNext(fail: boolean): void {
    this.failNext = fail;
  }

  clearFixtures(): void {
    this.fixtureByPage.clear();
    this.failNext = false;
  }

  recognizePages(pages: OcrPageInput[]): Promise<OcrDocumentResult> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.resolve({
        providerName: this.name,
        status: 'failed',
        warnings: ['Mock OCR intentionally failed.'],
        pages: pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.existingText,
          status: 'failed' as const,
          warning: 'Mock OCR failure',
        })),
      });
    }

    const results = pages.map((page) => {
      const fixture = this.fixtureByPage.get(page.pageNumber);
      if (fixture !== undefined) {
        return {
          pageNumber: page.pageNumber,
          text: fixture,
          status: 'completed' as const,
        };
      }
      // Without a fixture, do not invent content — report failure for empty scans.
      if (!page.existingText.trim()) {
        return {
          pageNumber: page.pageNumber,
          text: '',
          status: 'failed' as const,
          warning: 'No OCR fixture text configured for this page',
        };
      }
      return {
        pageNumber: page.pageNumber,
        text: page.existingText,
        status: 'completed' as const,
      };
    });

    const anyFailed = results.some((page) => page.status === 'failed');
    const anyCompleted = results.some((page) => page.status === 'completed');

    return Promise.resolve({
      providerName: this.name,
      status:
        anyFailed && !anyCompleted
          ? 'failed'
          : anyFailed
            ? 'completed'
            : 'completed',
      warnings: results
        .map((page) => page.warning)
        .filter((warning): warning is string => Boolean(warning)),
      pages: results,
    });
  }
}
