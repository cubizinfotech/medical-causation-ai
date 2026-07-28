/**
 * Top-level knowledge base folder names (must match directory structure).
 */
export const KNOWLEDGE_BASE_FOLDERS = {
  BOOKS: 'books',
  ARTICLES: 'articles',
  REPORTS: 'reports',
  TEMPLATES: 'templates',
  UPLOADS: 'uploads',
} as const;

export type KnowledgeBaseFolder =
  (typeof KNOWLEDGE_BASE_FOLDERS)[keyof typeof KNOWLEDGE_BASE_FOLDERS];

export const KNOWLEDGE_BASE_FOLDER_LIST: KnowledgeBaseFolder[] = [
  KNOWLEDGE_BASE_FOLDERS.BOOKS,
  KNOWLEDGE_BASE_FOLDERS.ARTICLES,
  KNOWLEDGE_BASE_FOLDERS.REPORTS,
  KNOWLEDGE_BASE_FOLDERS.TEMPLATES,
  KNOWLEDGE_BASE_FOLDERS.UPLOADS,
];

/**
 * Document knowledge categories for classification and filtering.
 */
export const KNOWLEDGE_CATEGORIES = {
  MEDICAL_BOOK: 'medical_book',
  RESEARCH_ARTICLE: 'research_article',
  CASE_REPORT: 'case_report',
  CLINICAL_GUIDELINE: 'clinical_guideline',
  MEDICAL_RECORD: 'medical_record',
  TEMPLATE: 'template',
  OTHER: 'other',
} as const;

export type KnowledgeCategory =
  (typeof KNOWLEDGE_CATEGORIES)[keyof typeof KNOWLEDGE_CATEGORIES];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  [KNOWLEDGE_CATEGORIES.MEDICAL_BOOK]: 'Medical Book',
  [KNOWLEDGE_CATEGORIES.RESEARCH_ARTICLE]: 'Research Article',
  [KNOWLEDGE_CATEGORIES.CASE_REPORT]: 'Case Report',
  [KNOWLEDGE_CATEGORIES.CLINICAL_GUIDELINE]: 'Clinical Guideline',
  [KNOWLEDGE_CATEGORIES.MEDICAL_RECORD]: 'Medical Record',
  [KNOWLEDGE_CATEGORIES.TEMPLATE]: 'Template',
  [KNOWLEDGE_CATEGORIES.OTHER]: 'Other',
};

/**
 * Default category mapping from knowledge base folder to category.
 */
export const FOLDER_CATEGORY_MAP: Record<
  KnowledgeBaseFolder,
  KnowledgeCategory
> = {
  [KNOWLEDGE_BASE_FOLDERS.BOOKS]: KNOWLEDGE_CATEGORIES.MEDICAL_BOOK,
  [KNOWLEDGE_BASE_FOLDERS.ARTICLES]: KNOWLEDGE_CATEGORIES.RESEARCH_ARTICLE,
  [KNOWLEDGE_BASE_FOLDERS.REPORTS]: KNOWLEDGE_CATEGORIES.CASE_REPORT,
  [KNOWLEDGE_BASE_FOLDERS.TEMPLATES]: KNOWLEDGE_CATEGORIES.TEMPLATE,
  [KNOWLEDGE_BASE_FOLDERS.UPLOADS]: KNOWLEDGE_CATEGORIES.OTHER,
};

/**
 * Document indexing/processing status.
 */
export const DOCUMENT_STATUS = {
  PENDING: 'pending',
  INDEXED: 'indexed',
  PROCESSING: 'processing',
  FAILED: 'failed',
  IGNORED: 'ignored',
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

/**
 * Supported document file extensions (lowercase, without dot).
 */
export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const SUPPORTED_MIME_TYPES: Record<SupportedExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
};

/**
 * Dashboard section labels for future UI (keyed by folder name).
 */
export const KNOWLEDGE_BASE_SECTIONS: Record<KnowledgeBaseFolder, string> = {
  [KNOWLEDGE_BASE_FOLDERS.BOOKS]: 'Books',
  [KNOWLEDGE_BASE_FOLDERS.ARTICLES]: 'Articles',
  [KNOWLEDGE_BASE_FOLDERS.REPORTS]: 'Reports',
  [KNOWLEDGE_BASE_FOLDERS.TEMPLATES]: 'Templates',
  [KNOWLEDGE_BASE_FOLDERS.UPLOADS]: 'Uploads',
};
