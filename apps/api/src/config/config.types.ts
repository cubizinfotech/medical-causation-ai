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

export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AnthropicProviderSettings extends AIProviderSettings {
  /** output_config.effort for models with adaptive thinking (ANTHROPIC_EFFORT). */
  effort: AnthropicEffort;
  /** Lower bound for max_tokens on thinking models (ANTHROPIC_MAX_TOKENS). */
  minMaxTokens: number;
  /** Required by API keys that are not scoped to a workspace (ANTHROPIC_WORKSPACE_ID). */
  workspaceId?: string;
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

/** Public medical literature search (PubMed, with Europe PMC abstracts). */
export interface LiteratureSearchSettings {
  enabled: boolean;
  pubmedBaseUrl: string;
  europePmcBaseUrl: string;
  /** Optional NCBI key: raises the limit from 3 to 10 requests per second. */
  pubmedApiKey?: string;
  /** NCBI asks callers to identify themselves with tool and email. */
  tool: string;
  email?: string;
  maxResults: number;
  resultsPerQuery: number;
  timeoutMs: number;
}

/** Client medical records uploaded for MCA cases. */
export interface CaseRecordsSettings {
  storagePath: string;
  maxFileSizeBytes: number;
  maxFilesPerCase: number;
  /** Total pages across all records of one analysis. */
  maxPagesPerCase: number;
  /** Characters of record text per chronology extraction call. */
  chronologyBatchChars: number;
  /** Characters of chronology given to the causation analysis prompt. */
  chronologyPromptChars: number;
  /** Unattached uploads are deleted after this many hours. */
  stagedTtlHours: number;
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

/**
 * EWI FOIA / university / outreach request workflow.
 * Recipient addresses are supplied per request. Credentials stay in email env only.
 */
export interface EwiRequestWorkflowSettings {
  /** When false, preparation and send paths stay inactive for investigations. */
  enabled: boolean;
  /** When true and other gates pass, approved requests may be sent without a second click. */
  autoSend: boolean;
  /** When true, requests must be approved before send. */
  requireApproval: boolean;
  /** Days after a successful send before a follow-up draft is due. */
  followUpDays: number;
  /** TrialSmith outreach only when specifically enabled. */
  trialsmithEnabled: boolean;
  /** Display name used in templates when the caller does not supply one. */
  senderName: string;
  /** Per-type automation flags. False forces manual review for that type. */
  allowFoia: boolean;
  allowUniversityFile: boolean;
  allowGraduationAnnouncement: boolean;
  allowUniversityEmployment: boolean;
  allowFollowUp: boolean;
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
  /** mock uses local fixtures; live calls the connected public sources (NPI Registry, Open Payments, OpenAlex, CourtListener). */
  mode: 'mock' | 'live';
  timeoutMs: number;
  retryMaxAttempts: number;
  retryDelayMs: number;
  /** Minimum gap between calls to the same provider. 0 disables the local limiter. */
  minIntervalMs: number;
  /** Optional. CourtListener search works without it; opinion excerpts need it. */
  courtListenerToken?: string;
  /** CourtListener full-text search can take 30+ seconds. */
  courtListenerTimeoutMs: number;
  /** Optional OpenAlex API key. */
  openAlexApiKey?: string;
  /** Optional contact address OpenAlex asks API users to send. */
  openAlexMailto?: string;
  /** Most recent CMS Open Payments program years to total. */
  openPaymentsYears: number;
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

export interface OcrSettings {
  provider: 'mock' | 'disabled';
  autoOcr: boolean;
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
  ocr: OcrSettings;
  logging: LoggingSettings;
  email: EmailSettings;
  ewiRequest: EwiRequestWorkflowSettings;
  auth: AuthSettings;
  jobs: JobsSettings;
  research: ResearchProviderSettings;
  literature: LiteratureSearchSettings;
  caseRecords: CaseRecordsSettings;
  features: FeatureFlags;
  indexing: IndexingConfigSettings;
  rag: RagConfigSettings;
}
