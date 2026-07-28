import type { RetrievalResponse } from "./types";

/**
 * Frontend RAG client (API stubs for future phase).
 */
export class RagClient {
  private readonly basePath = "/rag";

  /**
   * @future POST /rag/retrieve
   */
  async retrieve(_question: string): Promise<RetrievalResponse> {
    void this.basePath;
    void _question;
    throw new Error("RAG retrieval API is not yet implemented.");
  }
}

export const ragClient = new RagClient();
