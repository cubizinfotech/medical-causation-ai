import { apiUrl } from "@/lib/config";
import type {
  DocumentListOptions,
  DocumentListResult,
  KnowledgeBaseDashboard,
  KnowledgeBaseDashboardStats,
  KnowledgeBaseSectionSummary,
  KnowledgeDocument,
} from "./types";

/**
 * Frontend knowledge base service.
 * API integration will be wired in a future phase.
 */
export class KnowledgeBaseClient {
  private readonly basePath = "/knowledge-base";

  /**
   * @future GET /knowledge-base/documents
   */
  async listDocuments(
    options?: DocumentListOptions,
  ): Promise<DocumentListResult> {
    void options;
    void apiUrl(`${this.basePath}/documents`);
    throw new Error("Knowledge base list API is not yet implemented.");
  }

  /**
   * @future GET /knowledge-base/documents/:id
   */
  async getDocument(id: string): Promise<KnowledgeDocument> {
    void id;
    void apiUrl(`${this.basePath}/documents`);
    throw new Error("Knowledge base get document API is not yet implemented.");
  }

  /**
   * @future POST /knowledge-base/refresh
   */
  async refreshKnowledgeBase(): Promise<void> {
    void apiUrl(`${this.basePath}/refresh`);
    throw new Error("Knowledge base refresh API is not yet implemented.");
  }

  /**
   * @future GET /knowledge-base/stats
   */
  async getDashboardStats(): Promise<KnowledgeBaseDashboardStats> {
    void apiUrl(`${this.basePath}/stats`);
    throw new Error("Knowledge base stats API is not yet implemented.");
  }

  /**
   * @future GET /knowledge-base/sections
   */
  async getSectionSummaries(): Promise<KnowledgeBaseSectionSummary[]> {
    void apiUrl(`${this.basePath}/sections`);
    throw new Error("Knowledge base sections API is not yet implemented.");
  }

  /**
   * @future GET /knowledge-base/dashboard
   */
  async getDashboard(): Promise<KnowledgeBaseDashboard> {
    void apiUrl(`${this.basePath}/dashboard`);
    throw new Error("Knowledge base dashboard API is not yet implemented.");
  }
}

export const knowledgeBaseClient = new KnowledgeBaseClient();

/**
 * Placeholder dashboard data for future UI development.
 */
export function createEmptyDashboard(): KnowledgeBaseDashboard {
  return {
    title: "Knowledge Base",
    stats: {
      totalFiles: 0,
      indexedFiles: 0,
      pendingFiles: 0,
      processingFiles: 0,
      failedFiles: 0,
      ignoredFiles: 0,
      totalSizeBytes: 0,
      lastScannedAt: null,
    },
    sections: [],
  };
}
