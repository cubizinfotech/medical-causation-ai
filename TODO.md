# TODO — Medical Causation AI

## Phase 1 — Project Foundation ✅

- [x] Clean default Next.js and NestJS starter code
- [x] Create enterprise folder structure (frontend + backend)
- [x] Verify `knowledge-base/` directory structure
- [x] Create `knowledge-base/README.md`
- [x] Create documentation structure (`docs/`)
- [x] Populate `README.md`, `TODO.md`, `CHANGELOG.md`
- [x] Create `.env.example` with AI provider placeholders
- [x] Configure TypeScript path aliases
- [x] Create client-friendly `docs/index.html`

## Phase 1 — Infrastructure ✅

- [x] Docker Compose (postgres, redis, pgadmin, api, web)
- [x] `docker-compose.dev.yml` development overrides
- [x] Multi-stage Dockerfiles for NestJS and Next.js
- [x] PostgreSQL 17 + pgvector initialization scripts
- [x] Redis configuration for caching and future queues
- [x] Comprehensive `.env.example` with all sections
- [x] Backend configuration modules (App, Database, Redis, AI, Storage, Logging)
- [x] Frontend centralized configuration (`lib/config`)
- [x] Root `package.json` with workspace scripts
- [x] Update README, development.md, deployment.md

## Phase 1 — AI Foundation ✅

- [x] Reusable AI module (`apps/api/src/ai/`)
- [x] `ILlmProvider` interface with 5 provider stubs
- [x] `IEmbeddingProvider` interface with 6 provider stubs
- [x] `AiService` single entry point
- [x] `PromptService` with file-based templates
- [x] Configuration classes (Provider, Embedding, Prompt, Token)
- [x] Token usage types and AI exceptions
- [x] Frontend `AiClient` service layer (stubs)
- [x] Update `docs/ai-architecture.md`

## Phase 1 — Knowledge Base Foundation ✅

- [x] Knowledge base module (`apps/api/src/modules/knowledge-base/`)
- [x] Document discovery service (recursive scan, metadata, checksum)
- [x] Knowledge categories, statuses, supported extensions
- [x] Validation utilities (extension, size, filename, duplicates)
- [x] KnowledgeBaseService (discover, list, get, refresh, validate, stats)
- [x] Extended storage configuration with per-folder paths
- [x] Frontend feature types and service stubs
- [x] `docs/knowledge-base.md`

## Phase 2 — Document Processing Foundation ✅

- [x] Document processing module (`apps/api/src/modules/document-processing/`)
- [x] Generic `IDocumentParser` interface and `ParserFactory`
- [x] PDF parser (pdfjs-dist, page-by-page, OCR detection)
- [x] DOCX parser (mammoth, headings/paragraphs/tables)
- [x] TXT and Markdown parsers with normalization
- [x] Metadata extraction (word count, tokens, page count, file stats)
- [x] Text normalization utilities (unicode, whitespace, line endings)
- [x] `DocumentProcessingService` pipeline entry point
- [x] Reusable exceptions (UnsupportedFileType, DocumentCorrupted, etc.)
- [x] Frontend document processing types and client stubs
- [x] `docs/document-processing.md`
- [x] Unit and integration tests (PDF, DOCX, TXT, MD)

## Phase 2 — Knowledge Indexing Pipeline ✅

- [x] Indexing module (`apps/api/src/modules/indexing/`)
- [x] Token-aware `ChunkingService` with configurable size/overlap
- [x] Chunk metadata (page, section, order, tokens, source file)
- [x] Embedding provider implementations (OpenAI, OpenRouter, Gemini, Voyage, Jina, Nomic, Ollama)
- [x] OpenRouter embeddings with retries, timeout, rate limit handling
- [x] Prisma schema + pgvector tables (`indexed_documents`, `document_chunks`, `chunk_embeddings`)
- [x] `IndexingService` pipeline (parse → chunk → embed → store)
- [x] Duplicate detection via checksum + modified date
- [x] `IndexingJobService` (queue-ready, BullMQ stub)
- [x] `IndexingStatsService` monitoring metrics
- [x] Frontend indexing types and client stubs
- [x] `docs/indexing.md`

## Phase 2 — RAG Retrieval Engine ✅

- [x] RAG module (`apps/api/src/modules/rag/`)
- [x] `RetrievalService` with case context input
- [x] Hybrid search (pgvector + PostgreSQL full-text)
- [x] Metadata filters (category, sub-category, page range, document type)
- [x] `IReranker` interface with score-based default + future provider stubs
- [x] `ContextBuilder` with deduplication and token limits
- [x] `CitationManager` with document name, page, chunk number
- [x] Conversation context types (architecture only)
- [x] `RetrievalLoggingService` (no PII)
- [x] Multi-source retriever architecture (`IKnowledgeRetriever`)
- [x] Frontend RAG types and client stubs
- [x] `docs/rag-workflow.md`

## Phase 2 — Medical Analysis Engine ✅

- [x] Medical analysis module (`apps/api/src/modules/medical-analysis/`)
- [x] `MedicalAnalysisService` — RAG → context → LLM → structured JSON
- [x] Prompt templates (system, analysis, evidence evaluation, JSON output)
- [x] Evidence classification (supporting, opposing, neutral, unknown)
- [x] Confidence score with disclaimer (not a diagnosis)
- [x] Citation mapping and hallucination validation
- [x] LLM provider implementations (OpenRouter, OpenAI, Claude, Gemini, Groq)
- [x] Frontend `apps/web/src/features/medical-analysis/` types and stubs
- [x] `docs/medical-analysis.md`

## Phase 3 — Demonstration UI ✅

- [x] Professional landing page (`/`)
- [x] Medical case form with React Hook Form + Zod (`/case`)
- [x] Optional file upload display (PDF, DOCX, TXT, MD)
- [x] `POST /medical-analysis/analyze` API endpoint
- [x] Analysis processing screen with animated progress (`/analysis`)
- [x] TanStack Query integration with real backend
- [x] Error handling with retry
- [x] Reusable demo components (CaseForm, FileUploader, ProgressTimeline, etc.)
- [x] Shadcn-style UI components
- [x] `docs/frontend-demo.md`

## Final Review — Demonstration Readiness ✅

- [x] Full lint / typecheck / build / test validation
- [x] Test fixture fixes for `RetrievalResult` type
- [x] Removed unused `@radix-ui/react-select` dependency
- [x] Removed duplicate `apps/web/package-lock.json`
- [x] Created `DEMO_GUIDE.md` and `DEPLOYMENT.md`
- [x] Updated README, architecture, and RAG documentation
- [x] Root `npm run validate` script
- [x] Security review (no hardcoded secrets in source)

## Phase 2 — Database & API Foundation

- [ ] Root monorepo workspace configuration (npm/pnpm workspaces)
- [ ] Prisma schema and initial migrations
- [ ] Database module (`apps/api/src/database/`)
- [ ] Health check endpoint (`GET /health`)
- [ ] Swagger/OpenAPI setup
- [ ] Structured logging (Winston or Pino)
- [ ] Global exception filter and validation pipe
- [ ] `.gitignore` production hardening
- [ ] CI pipeline (lint + test + build)

## Phase 3 — Authentication & Multi-Tenancy

- [ ] JWT authentication module
- [ ] Law firm (tenant) entity and isolation
- [ ] User roles: Attorney, Paralegal, Medical Expert, Admin
- [ ] Auth guards and decorators
- [ ] Frontend auth provider and protected routes
- [ ] Shadcn/UI component library setup

## Phase 4 — Medical Literature Search

- [ ] PubMed API integration
- [ ] PubMed Central (PMC) integration
- [ ] ClinicalTrials.gov integration
- [ ] Crossref integration
- [ ] Semantic Scholar integration
- [ ] Literature search service and caching

## Phase 5 — RAG & Knowledge Base

- [ ] PDF parsing service
- [ ] Document chunking (LangChain)
- [ ] Embedding generation (configurable provider)
- [ ] pgvector indexing
- [ ] BullMQ ingestion queue
- [ ] Knowledge base upload UI
- [ ] Hybrid search (vector + full-text)

## Phase 6 — Medical Causation Engine

- [ ] Case management module
- [ ] Causation analysis workflow
- [ ] Bradford Hill criteria engine
- [ ] Probability calculator
- [ ] AI evidence synthesis chain
- [ ] Citation management

## Phase 7 — Report Generation

- [ ] Report templates
- [ ] PDF report generator
- [ ] Attorney download workflow
- [ ] Report versioning and audit trail

## Phase 8 — Admin & Operations

- [ ] Admin panel
- [ ] Audit logs
- [ ] Notification system
- [ ] Usage analytics

## Phase 9 — Billing (Future)

- [ ] Subscription management
- [ ] Stripe integration
- [ ] Usage metering
