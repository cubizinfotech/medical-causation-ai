export { KnowledgeBaseModule } from './knowledge-base.module';
export {
  KNOWLEDGE_BASE_FOLDERS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  DOCUMENT_STATUS,
  SUPPORTED_EXTENSIONS,
  KNOWLEDGE_BASE_SECTIONS,
} from './constants';
export type {
  KnowledgeDocument,
  KnowledgeBaseStats,
  KnowledgeBaseSectionSummary,
  KnowledgeBaseRefreshResult,
  DocumentListOptions,
  DocumentListResult,
} from './types';
export { KnowledgeBaseService, DocumentDiscoveryService } from './services';
