import type { OcrStatus } from '@modules/document-processing';

/**
 * Document kinds the EWI client expects to process.
 */
export const EWI_DOCUMENT_KINDS = [
  'cv',
  'pdf',
  'court_document',
  'state_licensing',
  'deposition_transcript',
  'article',
  'report',
  'presentation',
  'research_other',
] as const;

export type EwiDocumentKind = (typeof EWI_DOCUMENT_KINDS)[number];

/**
 * Links a finding to a concrete document location.
 * Page and Bates values are only set when detected — never fabricated.
 */
export interface EwiEvidenceReference {
  evidenceId: string;
  documentId: string;
  documentTitle: string;
  documentKind: EwiDocumentKind;
  /** Observed PDF/image page number, or null when unknown. */
  pageNumber: number | null;
  /** Detected Bates stamp, or null when not present in the text. */
  batesNumber: string | null;
  sourceUrl: string | null;
  /** Optional short excerpt from the cited location (collected text only). */
  excerpt: string | null;
  ocrStatus: OcrStatus;
  storageStatus: 'stored' | 'metadata_only' | 'rejected' | 'not_stored';
}

/**
 * Processed EWI evidence document after shared pipeline + EWI policies.
 */
export interface EwiEvidenceDocument {
  documentId: string;
  investigationId?: string;
  kind: EwiDocumentKind;
  title: string;
  filename: string;
  checksum: string;
  sourceUrl: string | null;
  sourceProvider: string | null;
  access: 'public' | 'restricted' | 'unavailable';
  storageStatus: 'stored' | 'metadata_only' | 'rejected' | 'not_stored';
  ocrStatus: OcrStatus;
  ocrAttempted: boolean;
  pageCount: number;
  pageReferences: Array<{
    pageNumber: number;
    batesNumbers: string[];
    charCount: number;
  }>;
  batesNumbers: string[];
  /** Full text only when storage policy allows persistence. */
  normalizedText: string;
  warnings: string[];
  duplicateOfDocumentId: string | null;
  processedAt: string;
  evidenceReferences: EwiEvidenceReference[];
}

/**
 * Table of contents / report reference entry linking report sections to evidence.
 */
export interface EwiReportReferenceEntry {
  sectionId: string;
  sectionTitle: string;
  sectionNumber: number;
  evidenceReferences: EwiEvidenceReference[];
}

export interface EwiReportReferenceIndex {
  investigationId?: string;
  generatedAt: string;
  entries: EwiReportReferenceEntry[];
  /** Flat searchable Bates → evidence refs */
  batesIndex: Record<string, EwiEvidenceReference[]>;
  /** Flat searchable page → evidence refs (keyed as documentId:page) */
  pageIndex: Record<string, EwiEvidenceReference[]>;
}
