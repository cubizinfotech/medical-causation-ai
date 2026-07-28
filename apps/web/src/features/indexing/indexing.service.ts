import type { IndexedDocument, IndexingJob, IndexingStats } from "./types";

/**
 * Frontend indexing client (API stubs for future phase).
 */
export class IndexingClient {
  private readonly basePath = "/indexing";

  /**
   * @future POST /indexing/documents/:documentId
   */
  async indexDocument(_documentId: string): Promise<IndexedDocument> {
    void this.basePath;
    void _documentId;
    throw new Error("Indexing API is not yet implemented.");
  }

  /**
   * @future GET /indexing/stats
   */
  async getStats(): Promise<IndexingStats> {
    void this.basePath;
    throw new Error("Indexing stats API is not yet implemented.");
  }

  /**
   * @future GET /indexing/jobs/:jobId
   */
  async getJobStatus(_jobId: string): Promise<IndexingJob> {
    void this.basePath;
    void _jobId;
    throw new Error("Indexing job status API is not yet implemented.");
  }
}

export const indexingClient = new IndexingClient();
