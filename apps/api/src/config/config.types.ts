import type { ProviderConfigSettings } from './ai-config.types';

export interface AppSettings {
  name: string;
  port: number;
  nodeEnv: string;
  /** Browser origin allowed by CORS. */
  frontendUrl: string;
  /** Public API base URL (server-side). Not an API key. */
  apiPublicUrl: string;
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

export interface ProductKnowledgeBaseSettings {
  mca: KnowledgeBasePaths;
  ewi: KnowledgeBasePaths;
}

export type StorageDriver = 'local';

export interface StorageSettings {
  /** local filesystem today; object-store drivers stay env-gated for later. */
  driver: StorageDriver;
  /** @deprecated Use knowledgeBase.root (MCA default) */
  knowledgeBasePath: string;
  /** MCA knowledge base paths (default corpus). */
  knowledgeBase: KnowledgeBasePaths;
  /** Product-scoped knowledge base roots. */
  products: ProductKnowledgeBaseSettings;
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
  enableMca: boolean;
  enableEwi: boolean;
  enableEmail: boolean;
  enableAuth: boolean;
}

export type EmailProviderName = 'console' | 'smtp' | 'transactional';

export interface EmailSettings {
  /**
   * console logs mail. smtp transmits only when delivery is enabled and the
   * host is allowed. transactional is reserved until a vendor is confirmed.
   */
  provider: EmailProviderName;
  /** True only when EMAIL_DELIVERY_ENABLED or FEATURE_EMAIL is true. */
  deliveryEnabled: boolean;
  from: string;
  fromName: string;
  replyTo: string;
  /** When set, every recipient is replaced with this address. */
  redirectTo: string;
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  maxAttempts: number;
  retryDelayMs: number;
}

export interface AuthSettings {
  enabled: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export interface JobsSettings {
  stateTtlSeconds: number;
  concurrency: number;
  mcaQueuePrefix: string;
  ewiQueuePrefix: string;
}

export interface ResearchProviderSettings {
  /** mock uses local fixtures; live does not call external research APIs until an adapter is connected. */
  mode: 'mock' | 'live';
  timeoutMs: number;
  retryMaxAttempts: number;
  retryDelayMs: number;
  /** Minimum gap between calls to the same provider. 0 disables the local limiter. */
  minIntervalMs: number;
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
  email: EmailSettings;
  auth: AuthSettings;
  jobs: JobsSettings;
  research: ResearchProviderSettings;
  features: FeatureFlags;
  indexing: IndexingConfigSettings;
  rag: RagConfigSettings;
}
