export { OcrService, OCR_PROVIDER } from './ocr.service';
export { MockOcrProvider } from './mock-ocr.provider';
export { DisabledOcrProvider } from './disabled-ocr.provider';
export type {
  IOcrProvider,
  OcrDocumentResult,
  OcrPageInput,
  OcrPageResult,
} from './ocr.types';
export { mergeOcrIntoPages } from './ocr.types';
