/**
 * Storage / retention policy for processed documents.
 * Lexis and other restricted PDFs must not be stored.
 */

export type DocumentStorageDecision =
  'store_allowed' | 'metadata_only' | 'rejected';

export interface DocumentStoragePolicyInput {
  filename: string;
  extension: string;
  sourceProvider?: string;
  sourceUrl?: string;
  access?: 'public' | 'restricted' | 'unavailable';
  /** Explicit caller flag that content storage is permitted. */
  storagePermitted?: boolean;
}

export interface DocumentStoragePolicyResult {
  decision: DocumentStorageDecision;
  reason: string;
  /** When false, file bytes must not be retained. */
  mayPersistFile: boolean;
  /** When false, extracted body text must not be persisted. */
  mayPersistExtractedText: boolean;
}

const RESTRICTED_PROVIDERS = new Set(['lexisnexis', 'lexis', 'westlaw']);

const RESTRICTED_HOST_FRAGMENTS = [
  'lexisnexis.com',
  'advance.lexis.com',
  'westlaw.com',
];

/**
 * Decide whether a document may be stored on disk / in the knowledge base.
 */
export function evaluateDocumentStorage(
  input: DocumentStoragePolicyInput,
): DocumentStoragePolicyResult {
  const provider = (input.sourceProvider ?? '').toLowerCase();
  const url = (input.sourceUrl ?? '').toLowerCase();
  const access = input.access ?? 'public';
  const extension = input.extension.toLowerCase().replace(/^\./, '');

  if (RESTRICTED_PROVIDERS.has(provider)) {
    return {
      decision: 'rejected',
      reason:
        'LexisNexis/Westlaw documents require authorized access and PDFs must not be stored.',
      mayPersistFile: false,
      mayPersistExtractedText: false,
    };
  }

  if (RESTRICTED_HOST_FRAGMENTS.some((host) => url.includes(host))) {
    return {
      decision: 'rejected',
      reason:
        'Document URL indicates a licensed legal research host. PDF storage is not permitted.',
      mayPersistFile: false,
      mayPersistExtractedText: false,
    };
  }

  if (access === 'restricted') {
    return {
      decision: 'metadata_only',
      reason:
        'Restricted source: metadata and links may be retained; document body and PDF are not stored.',
      mayPersistFile: false,
      mayPersistExtractedText: false,
    };
  }

  if (input.storagePermitted === false) {
    return {
      decision: 'metadata_only',
      reason:
        'Caller indicated storage is not permitted for this document under applicable permissions.',
      mayPersistFile: false,
      mayPersistExtractedText: false,
    };
  }

  // Public PDFs/DOCX may be stored only when permissions allow (default true for public uploads).
  if (
    ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'tif', 'tiff'].includes(extension)
  ) {
    if (input.storagePermitted === undefined && access === 'public') {
      return {
        decision: 'store_allowed',
        reason:
          'Public document storage allowed subject to applicable permissions.',
        mayPersistFile: true,
        mayPersistExtractedText: true,
      };
    }
  }

  return {
    decision: 'store_allowed',
    reason: 'Document may be stored according to applicable permissions.',
    mayPersistFile: true,
    mayPersistExtractedText: true,
  };
}
