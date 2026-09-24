# TODO — Medical Causation AI

## Current product status

MCA and EWI run in one monorepo. Local development uses Docker for PostgreSQL and Redis and does not need DigitalOcean or paid API credentials.

- [x] MCA case analysis, history, and on-screen report (`/mca`)
- [x] EWI investigation workflow, grounded questions, and Word report (`/ewi`)
- [x] Shared platform auth (off unless `AUTH_ENABLED=true`) and demo user seed
- [x] Email providers: console locally, SMTP only when delivery is explicitly enabled
- [x] Research provider catalog with local mock fixtures. Live vendor HTTP is not connected
- [x] Documentation set under `docs/`, including [digitalocean.md](docs/digitalocean.md) and [index.html](docs/index.html)
- [ ] Law-firm tenancy
- [ ] Live research and literature HTTP calls
- [ ] MCA PDF file export
- [ ] Production backups (not approved)
- [ ] CI pipeline and Swagger

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

## Phase 4b — MCA + EWI Dual-Product Architecture ✅

- [x] Common / MCA / EWI module boundaries (`platform`, `modules/mca`, `modules/ewi`)
- [x] Relocate medical-analysis under `modules/mca` without behavior change
- [x] Prisma `ewi` schema + `product` corpus on indexed documents
- [x] Separate Redis/BullMQ prefixes and EWI investigation queue
- [x] Product-scoped knowledge base paths (`knowledge-base/ewi`)
- [x] EWI vertical slice: mock research, discrepancies, 100+ questions, Word report
- [x] Shared Word renderer plus EWI report template, versioned file, and grounded cross-examination questions (`docs/ewi-report-workflow.md`)
- [x] `IExpertResearchSource` + mock/stub adapters
- [x] Frontend `/` chooser, `/mca/*`, `/ewi/*`, legacy redirects
- [x] Documentation updates (architecture, EWI, decisions, README, TODO)

## Phase 4c — Common / MCA / EWI Folder Structure ✅

- [x] Expand `platform/` scaffolds (auth, users, email, audit, report, storage, search, jobs)
- [x] Add `modules/common` facade for shared KB/document/indexing/RAG modules
- [x] Keep MCA under `modules/mca` and frontend `features/mca` + `components/mca`
- [x] Keep EWI under `modules/ewi` and frontend `features/ewi` (no MCA cross-imports)
- [x] Add `@platform/*` path alias; update docs (architecture, folder-structure, README)
- [x] Compatibility re-exports for legacy MCA feature/component paths

## Phase 2 — Database & API Foundation

- [x] Root monorepo workspace configuration (npm workspaces)
- [x] Prisma schema and migrations (`documents`, `vectors`, `cases`, `ewi`, `platform`)
- [x] Database module (`apps/api/src/database/`)
- [x] Health check endpoint (`GET /health`, `GET /health/ready`)
- [ ] Swagger/OpenAPI setup
- [ ] Structured logging (Winston or Pino)
- [ ] Global exception filter and validation pipe
- [ ] `.gitignore` production hardening
- [ ] CI pipeline (lint + test + build)

## Phase 3 — Authentication & Multi-Tenancy

- [x] JWT authentication module (enforced when `AUTH_ENABLED=true`)
- [ ] Law firm (tenant) entity and isolation
- [x] User roles: Super Admin, Admin, Attorney, Paralegal, Medical Expert, User
- [x] Auth guards and decorators, including sockets
- [x] Frontend login and route gate when the API reports auth enabled
- [x] Shared UI component set used by MCA and EWI

## Phase 4 — Medical Literature Search

- [x] Provider interfaces and local fixtures for PubMed, Crossref, OpenAlex, and related EWI sources
- [ ] Live PubMed API calls
- [ ] Live PubMed Central (PMC) integration
- [ ] ClinicalTrials.gov integration
- [ ] Live Crossref calls
- [ ] Semantic Scholar integration
- [ ] Literature search wired into MCA (EWI catalog does not call vendors yet)

## Phase 5 — RAG & Knowledge Base

- [x] PDF, DOCX, and text parsing
- [x] Document chunking
- [x] Embedding generation (configurable provider)
- [x] pgvector indexing
- [ ] BullMQ ingestion queue (product jobs use BullMQ; indexing enqueue may still be a stub)
- [ ] Knowledge base upload UI
- [x] Hybrid search (vector + full-text)

## Phase 6 — Medical Causation Engine

- [x] Case history stored for MCA analyses
- [x] Causation analysis workflow (RAG plus structured model output)
- [ ] Bradford Hill criteria engine
- [ ] Probability calculator
- [x] AI evidence synthesis through `AiService`
- [x] Citation checks on model output

## Phase 7 — Report Generation

- [x] EWI Word template and shared docx renderer
- [ ] PDF report generator for MCA
- [x] Attorney download for the EWI Word file
- [x] EWI report version stored with the investigation

## Phase 8 — Admin & Operations

- [ ] Admin panel
- [ ] Audit logs
- [ ] Notification system
- [ ] Usage analytics

## Phase 9 — Billing (Future)

- [ ] Subscription management
- [ ] Stripe integration
- [ ] Usage metering
