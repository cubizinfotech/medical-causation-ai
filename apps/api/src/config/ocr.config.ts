export interface OcrSettings {
  /** mock | disabled — pluggable engines can be injected later. */
  provider: 'mock' | 'disabled';
  /** When true, OCR runs automatically for scanned PDFs/images. */
  autoOcr: boolean;
}

export const ocrConfig = (): OcrSettings => ({
  provider:
    (process.env.OCR_PROVIDER ?? 'mock').toLowerCase() === 'disabled'
      ? 'disabled'
      : 'mock',
  autoOcr: process.env.OCR_AUTO !== 'false',
});
