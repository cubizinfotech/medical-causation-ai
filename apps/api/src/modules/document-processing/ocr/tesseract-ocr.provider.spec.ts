import type { ConfigService } from '@nestjs/config';
import type { PdfPageOcr } from './pdf-page-ocr';
import { TesseractOcrProvider } from './tesseract-ocr.provider';

describe('TesseractOcrProvider', () => {
  const pdf = Buffer.from('%PDF-1.4');
  const recognize = jest.fn();

  function build(maxPages = 500): TesseractOcrProvider {
    return new TesseractOcrProvider(
      { recognize } as unknown as PdfPageOcr,
      {
        get: () => ({
          provider: 'tesseract',
          autoOcr: true,
          maxPages,
          dpi: 200,
        }),
      } as unknown as ConfigService,
    );
  }

  const textPage = {
    pageNumber: 1,
    existingText:
      'A page that already has a text layer, long enough to keep as it is.',
  };
  const scannedPage = { pageNumber: 2, existingText: '' };

  beforeEach(() => recognize.mockReset());

  it('reads only the scanned pages and keeps pages that have text', async () => {
    recognize.mockResolvedValue([
      { pageNumber: 2, text: 'Stroke risk after head injury', confidence: 91 },
    ]);

    const result = await build().recognizePages([textPage, scannedPage], {
      pdf,
    });

    expect(recognize).toHaveBeenCalledWith(
      pdf,
      [2],
      expect.objectContaining({ dpi: 200 }),
    );
    expect(result.status).toBe('completed');
    expect(result.pages).toEqual([
      { pageNumber: 1, text: textPage.existingText, status: 'completed' },
      {
        pageNumber: 2,
        text: 'Stroke risk after head injury',
        status: 'completed',
      },
    ]);
    expect(result.warnings[0]).toBe(
      '1 of 1 scanned page(s) were read with OCR.',
    );
  });

  it('never invents text for a page it could not read', async () => {
    recognize.mockResolvedValue([
      { pageNumber: 2, text: '', confidence: 0, error: 'render failed' },
    ]);

    const result = await build().recognizePages([scannedPage], { pdf });

    expect(result.status).toBe('failed');
    expect(result.pages[0]).toMatchObject({
      text: '',
      status: 'failed',
      warning: 'render failed',
    });
  });

  it('flags low-confidence pages', async () => {
    recognize.mockResolvedValue([
      { pageNumber: 2, text: 'blurry words', confidence: 40 },
    ]);

    const result = await build().recognizePages([scannedPage], { pdf });

    expect(result.warnings).toContain(
      '1 page(s) were read with low confidence; passages from them may contain reading errors.',
    );
  });

  it('skips a scan larger than OCR_MAX_PAGES with a clear warning', async () => {
    const pages = [1, 2, 3].map((pageNumber) => ({
      pageNumber,
      existingText: '',
    }));

    const result = await build(2).recognizePages(pages, { pdf });

    expect(recognize).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.warnings[0]).toMatch(
      /3 scanned pages is more than OCR_MAX_PAGES \(2\)/,
    );
  });

  it('does not run on files that are not PDFs', async () => {
    const result = await build().recognizePages([scannedPage]);

    expect(recognize).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
  });
});
