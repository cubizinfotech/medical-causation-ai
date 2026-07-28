/**
 * Knowledge base document categories.
 */
export const KNOWLEDGE_CATEGORIES = {
  MEDICAL_BOOK: "medical_book",
  RESEARCH_ARTICLE: "research_article",
  CASE_REPORT: "case_report",
  CLINICAL_GUIDELINE: "clinical_guideline",
  MEDICAL_RECORD: "medical_record",
  TEMPLATE: "template",
  OTHER: "other",
} as const;

export type KnowledgeCategory =
  (typeof KNOWLEDGE_CATEGORIES)[keyof typeof KNOWLEDGE_CATEGORIES];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  [KNOWLEDGE_CATEGORIES.MEDICAL_BOOK]: "Medical Book",
  [KNOWLEDGE_CATEGORIES.RESEARCH_ARTICLE]: "Research Article",
  [KNOWLEDGE_CATEGORIES.CASE_REPORT]: "Case Report",
  [KNOWLEDGE_CATEGORIES.CLINICAL_GUIDELINE]: "Clinical Guideline",
  [KNOWLEDGE_CATEGORIES.MEDICAL_RECORD]: "Medical Record",
  [KNOWLEDGE_CATEGORIES.TEMPLATE]: "Template",
  [KNOWLEDGE_CATEGORIES.OTHER]: "Other",
};

export const DOCUMENT_STATUS = {
  PENDING: "pending",
  INDEXED: "indexed",
  PROCESSING: "processing",
  FAILED: "failed",
  IGNORED: "ignored",
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export const KNOWLEDGE_BASE_FOLDERS = {
  BOOKS: "books",
  ARTICLES: "articles",
  REPORTS: "reports",
  TEMPLATES: "templates",
  UPLOADS: "uploads",
} as const;

export type KnowledgeBaseFolder =
  (typeof KNOWLEDGE_BASE_FOLDERS)[keyof typeof KNOWLEDGE_BASE_FOLDERS];

export const KNOWLEDGE_BASE_SECTIONS: Record<KnowledgeBaseFolder, string> = {
  [KNOWLEDGE_BASE_FOLDERS.BOOKS]: "Books",
  [KNOWLEDGE_BASE_FOLDERS.ARTICLES]: "Articles",
  [KNOWLEDGE_BASE_FOLDERS.REPORTS]: "Reports",
  [KNOWLEDGE_BASE_FOLDERS.TEMPLATES]: "Templates",
  [KNOWLEDGE_BASE_FOLDERS.UPLOADS]: "Uploads",
};

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md"] as const;
