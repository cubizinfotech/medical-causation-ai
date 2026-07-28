import type { ProcessedDocument } from "./types";

/**
 * Frontend document processing client (API stubs for future phase).
 */
export class DocumentProcessingClient {
  private readonly basePath = "/document-processing";

  /**
   * @future POST /document-processing/process/:documentId
   */
  async processDocument(_documentId: string): Promise<ProcessedDocument> {
    void this.basePath;
    void _documentId;
    throw new Error("Document processing API is not yet implemented.");
  }

  /**
   * @future GET /document-processing/status/:documentId
   */
  async getProcessingStatus(_documentId: string): Promise<{ status: string }> {
    void this.basePath;
    void _documentId;
    throw new Error("Document processing status API is not yet implemented.");
  }
}

export const documentProcessingClient = new DocumentProcessingClient();
