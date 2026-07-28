import type { ProviderConfigSettings } from './ai-config.types';

export interface AppSettings {
  name: string;
  port: number;
  nodeEnv: string;
  frontendUrl: string;
}

export interface DatabaseSettings {
  url: string;
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
}

export interface RedisSettings {
  url: string;
  host: string;
  port: number;
  password: string;
  db: number;
  keyPrefix: string;
  ttlSeconds: number;
}

export interface AIProviderSettings {
  apiKey: string;
  baseUrl: string;
  organization?: string;
  deploymentName?: string;
  apiVersion?: string;
}

export type AISettings = ProviderConfigSettings;

export interface KnowledgeBasePaths {
  root: string;
  books: string;
  articles: string;
  reports: string;
  templates: string;
  uploads: string;
}

export interface StorageSettings {
  /** @deprecated Use knowledgeBase.root */
  knowledgeBasePath: string;
  knowledgeBase: KnowledgeBasePaths;
  uploadMaxSizeMb: number;
  uploadMaxSizeBytes: number;
  knowledgeBaseMaxFileSizeMb: number;
  knowledgeBaseMaxFileSizeBytes: number;
  uploadDir: string;
}

export interface LoggingSettings {
  level: string;
  prettyPrint: boolean;
}

export interface FeatureFlags {
  enableAiProcessing: boolean;
  enableRag: boolean;
  enableLiteratureSearch: boolean;
}

export interface IndexingConfigSettings {
  chunkSizeTokens: number;
  chunkOverlapTokens: number;
  chunkMinSizeTokens: number;
  embeddingBatchSize: number;
  embeddingRetryMaxAttempts: number;
  embeddingRequestTimeoutMs: number;
  embeddingRetryDelayMs: number;
}

export interface RagConfigSettings {
  topK: number;
  vectorTopK: number;
  keywordTopK: number;
  maxContextTokens: number;
  vectorWeight: number;
  keywordWeight: number;
  minSimilarityScore: number;
  rrfK: number;
  defaultReranker: string;
}

export interface RootConfig {
  app: AppSettings;
  database: DatabaseSettings;
  redis: RedisSettings;
  ai: AISettings;
  embedding: import('./ai-config.types').EmbeddingConfigSettings;
  prompt: import('./ai-config.types').PromptConfigSettings;
  token: import('./ai-config.types').TokenConfigSettings;
  storage: StorageSettings;
  logging: LoggingSettings;
  features: FeatureFlags;
  indexing: IndexingConfigSettings;
  rag: RagConfigSettings;
}
