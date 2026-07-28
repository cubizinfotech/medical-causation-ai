import type {
  ProcessDocumentInput,
  ProcessDocumentOptions,
  ProcessedDocumentResult,
} from '../types';

/**
 * Contract for the document processing pipeline.
 */
export interface IDocumentProcessingService {
  processDocument(
    input: ProcessDocumentInput,
    options?: ProcessDocumentOptions,
  ): Promise<ProcessedDocumentResult>;

  processKnowledgeBaseDocument(
    documentId: string,
  ): Promise<ProcessedDocumentResult>;
}
