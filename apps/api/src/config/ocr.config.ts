export interface OcrSettings {
  /**
   * tesseract: read scanned PDF pages on this server (default).
   * mock: fixed test text, for tests. disabled: never read scans.
   */
  provider: 'tesseract' | 'mock' | 'disabled';
  /** When true, OCR runs automatically for scanned PDFs/images. */
  autoOcr: boolean;
  /** Most scanned pages read in one file; a larger scan is skipped with a warning. */
  maxPages: number;
  /** Render resolution for OCR. 200 dpi reads typical print well. */
  dpi: number;
}

function provider(value: string | undefined): OcrSettings['provider'] {
  const name = (value ?? '').trim().toLowerCase();
  return name === 'disabled' || name === 'mock' ? name : 'tesseract';
}

export const ocrConfig = (): OcrSettings => ({
  provider: provider(process.env.OCR_PROVIDER),
  autoOcr: process.env.OCR_AUTO !== 'false',
  maxPages: Number(process.env.OCR_MAX_PAGES ?? 500),
  dpi: Number(process.env.OCR_DPI ?? 200),
});
