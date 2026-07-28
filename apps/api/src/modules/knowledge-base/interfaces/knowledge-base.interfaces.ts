import type { KnowledgeDocument } from '../types';

/**
 * Contract for document discovery operations.
 */
export interface IDocumentDiscoveryService {
  /**
   * Scan all configured knowledge base folders and return discovered documents.
   */
  scan(): Promise<KnowledgeDocument[]>;

  /**
   * Scan a single folder within the knowledge base.
   */
  scanFolder(folder: string): Promise<KnowledgeDocument[]>;
}

/**
 * Contract for knowledge base management operations.
 */
export interface IKnowledgeBaseService {
  discoverDocuments(): Promise<KnowledgeDocument[]>;
  listDocuments(
    options?: import('../types').DocumentListOptions,
  ): Promise<import('../types').DocumentListResult>;
  getDocument(id: string): Promise<KnowledgeDocument | null>;
  refreshKnowledgeBase(): Promise<
    import('../types').KnowledgeBaseRefreshResult
  >;
  validateDocument(
    document: KnowledgeDocument,
  ): import('../types').DocumentValidationResult;
  getStats(): import('../types').KnowledgeBaseStats;
  getSectionSummaries(): import('../types').KnowledgeBaseSectionSummary[];
}
