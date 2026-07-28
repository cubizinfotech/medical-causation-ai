export {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  DOCUMENT_STATUS,
  KNOWLEDGE_BASE_FOLDERS,
  KNOWLEDGE_BASE_SECTIONS,
  SUPPORTED_EXTENSIONS,
} from "./constants";
export type {
  KnowledgeCategory,
  DocumentStatus,
  KnowledgeBaseFolder,
} from "./constants";
export type {
  KnowledgeDocument,
  DocumentListOptions,
  DocumentListResult,
  KnowledgeBaseDashboardStats,
  KnowledgeBaseSectionSummary,
  KnowledgeBaseDashboard,
} from "./types";
export {
  KnowledgeBaseClient,
  knowledgeBaseClient,
  createEmptyDashboard,
} from "./knowledge-base.service";
