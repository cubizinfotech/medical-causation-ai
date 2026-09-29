import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProcessedPage } from '../types';
import { DisabledOcrProvider } from './disabled-ocr.provider';
import { MockOcrProvider } from './mock-ocr.provider';
import {
  mergeOcrIntoPages,
  type IOcrProvider,
  type OcrDocumentResult,
  type OcrPageInput,
} from './ocr.types';

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');

/**
 * Runs OCR through the configured provider when scanned content is detected.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockOcrProvider,
    private readonly disabledProvider: DisabledOcrProvider,
  ) {}

  getActiveProvider(): IOcrProvider {
    const name = (
      this.configService.get<string>('ocr.provider') ?? 'mock'
    ).toLowerCase();
    if (name === 'disabled') return this.disabledProvider;
    return this.mockProvider;
  }

  /**
   * Recognize text for pages that need OCR. Preserves page numbers from input.
   */
  async recognizeDocumentPages(
    pages: ProcessedPage[],
    options: { force?: boolean } = {},
  ): Promise<{ pages: ProcessedPage[]; ocr: OcrDocumentResult }> {
    const provider = this.getActiveProvider();
    const inputs: OcrPageInput[] = pages.map((page) => ({
      pageNumber: page.pageNumber,
      existingText: page.text,
    }));

    if (!provider.isAvailable() && !options.force) {
      const ocr = await this.disabledProvider.recognizePages(inputs);
      return { pages: mergeOcrIntoPages(pages, ocr), ocr };
    }

    this.logger.log(
      `Running OCR via ${provider.name} for ${pages.length} page(s)`,
    );
    const ocr = await provider.recognizePages(inputs);
    return { pages: mergeOcrIntoPages(pages, ocr), ocr };
  }
}
