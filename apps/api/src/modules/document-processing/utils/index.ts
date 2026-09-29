export {
  normalizeText,
  countWords,
  estimateTokens,
  deriveTitle,
  joinPageTexts,
} from './text-normalization.util';

export {
  buildExtractedMetadata,
  readFileMetadata,
  summarizePages,
} from './metadata-extraction.util';

export { detectBatesNumbers, attachBatesToPages } from './bates-detection.util';

export { evaluateDocumentStorage } from './document-storage-policy.util';
export type {
  DocumentStorageDecision,
  DocumentStoragePolicyInput,
  DocumentStoragePolicyResult,
} from './document-storage-policy.util';
