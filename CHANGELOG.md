# Changelog

All notable changes to the **Medical Causation AI** platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Case history delete — `DELETE /medical-analysis/histories/:id` with confirmation dialog in UI
- PDF report export (replaces Markdown export) with terms & policy footer
- Human-readable private knowledge base source summaries in reports
- Client demo guide with step-by-step presentation flow ([DEMO_GUIDE.md](./DEMO_GUIDE.md))

### Changed

- Updated README, frontend-demo, and medical-analysis docs to reflect current features
- Analysis completion redirects to `/histories/{caseId}` instead of session-only report
- Session cache cleanup utilities for demo flow

### Removed

- Deprecated frontend `useMedicalAnalysis` hook and sync `analyze()` client method
- Unused `loadUploadedFileNames()` session storage helper

### Added

- Final demonstration review — validation fixes, documentation, demo/deployment guides
- `DEMO_GUIDE.md` and `DEPLOYMENT.md` at project root
- Root `npm run validate` script for full CI-style checks
- Test mock helper for `RetrievalResult`
- Removed unused `@radix-ui/react-select` dependency
- Removed duplicate `apps/web/package-lock.json`

### Added

- Phase 3 Demonstration UI — landing page, case form, analysis workflow
- `POST /medical-analysis/analyze` REST endpoint with validation
- Frontend pages: `/`, `/case`, `/analysis`
- React Hook Form + Zod case validation
- TanStack Query API integration
- Reusable demo components and Shadcn-style UI primitives
- `docs/frontend-demo.md`

### Added

- Phase 2d Medical Analysis Engine — RAG + LLM structured causation reasoning
- `apps/api/src/modules/medical-analysis/` module
- Prompt templates for system, analysis, evidence evaluation, and JSON output
- Evidence classification (supporting, opposing, neutral, unknown)
- Confidence score with safety disclaimer
- Citation validation to prevent hallucinated references
- LLM provider HTTP implementations (OpenRouter, OpenAI, Claude, Gemini, Groq)
- Frontend `apps/web/src/features/medical-analysis/` types and stubs
- `docs/medical-analysis.md`

### Added

- Phase 2c RAG Retrieval Engine — hybrid search, context builder, citations
- `apps/api/src/modules/rag/` module
- Hybrid retrieval (pgvector + PostgreSQL full-text search)
- Re-ranking interface with score-based default
- Context builder with deduplication and token limits
- Citation manager for report-ready references
- Multi-source retriever architecture
- Frontend `apps/web/src/features/rag/` types and stubs
- Updated `docs/rag-workflow.md`

### Added

- Phase 2b Knowledge Indexing Pipeline — chunking, embeddings, pgvector
- `apps/api/src/modules/indexing/` module
- Prisma ORM with `documents` and `vectors` schemas
- Token-aware chunking with configurable size and overlap
- Embedding provider implementations including OpenRouter
- `IndexingService`, duplicate detection, indexing stats
- Frontend `apps/web/src/features/indexing/` types and stubs
- `docs/indexing.md`

### Added

- Phase 2 Document Processing Foundation — parsing pipeline
- `apps/api/src/modules/document-processing/` module
- PDF parser (pdfjs-dist) with page-by-page extraction and OCR detection
- DOCX parser (mammoth) with headings, paragraphs, and tables
- TXT and Markdown parsers with text normalization
- `DocumentProcessingService` pipeline entry point
- Metadata extraction (word count, estimated tokens, page count, file stats)
- Reusable processing exceptions
- Frontend `apps/web/src/features/document-processing/` types and client stubs
- `docs/document-processing.md`

### Added

- Phase 1 infrastructure — Docker environment
- `docker-compose.yml` and `docker-compose.dev.yml` with all services
- Multi-stage Dockerfiles for NestJS (`docker/api/`) and Next.js (`docker/web/`)
- PostgreSQL 17 initialization scripts with pgvector, `uuid-ossp`, `pg_trgm` extensions
- PostgreSQL schemas: `app`, `documents`, `vectors` (no tables)
- Redis configuration (`docker/redis/redis.conf`) for caching and future BullMQ queues
- Backend configuration modules: `AppConfig`, `DatabaseConfig`, `RedisConfig`, `AIConfig`, `StorageConfig`, `LoggingConfig`, feature flags
- `@nestjs/config` integration with global `AppConfigModule`
- Frontend centralized configuration (`apps/web/src/lib/config/`)
- Root `package.json` with npm workspaces and Docker/dev scripts
- Comprehensive `.env.example` with grouped sections and comments
- Configuration unit tests (`configuration.spec.ts`)

### Changed

- `main.ts` uses `ConfigService` instead of direct `process.env` access
- `next.config.ts` enables `output: "standalone"` for Docker production builds
- Updated `README.md`, `docs/development.md`, `docs/deployment.md` with Docker workflows
- Frontend `layout.tsx` and `page.tsx` use centralized `lib/config`

### Added

- Phase 1 AI Foundation — provider-agnostic AI architecture
- `apps/api/src/ai/` module with LLM and embedding provider interfaces
- LLM provider stubs: OpenRouter, OpenAI, Anthropic, Gemini, Groq
- Embedding provider stubs: OpenAI, Gemini, Voyage, Jina, Nomic, Ollama
- `AiService` as single entry point for all AI operations
- `PromptService` with file-based template loading and `{{variable}}` substitution
- Prompt templates in `system/`, `medical/`, `reports/`, `testing/` categories
- AI configuration classes: ProviderConfig, EmbeddingConfig, PromptConfig, TokenConfig
- AI exception hierarchy (ProviderUnavailable, InvalidModel, RateLimitExceeded, etc.)
- Token usage types (promptTokens, completionTokens, estimatedCostUsd, executionTimeMs)
- Frontend `AiClient` service layer in `apps/web/src/services/ai/`
- AI architecture unit tests

### Changed

- Default LLM provider changed from `openai` to `openrouter`
- `AISettings` refactored to extend `ProviderConfigSettings` with `activeProvider` field
- `RootConfig` extended with `embedding`, `prompt`, and `token` configuration sections
- Updated `docs/ai-architecture.md` with full architecture documentation
- Updated `.env.example` with embedding providers, prompt config, and token limits

### Added

- Phase 1 Knowledge Base Foundation — document management architecture
- `modules/knowledge-base/` NestJS module with discovery and management services
- Recursive document scanner for `knowledge-base/` (PDF, DOCX, TXT, MD)
- Document metadata model with checksum, category, sub-category, status
- Validation utilities: extension, size, filename, duplicate detection
- Dashboard stats types (`KnowledgeBaseStats`, `KnowledgeBaseSectionSummary`)
- Frontend `features/knowledge-base/` with types and client stubs
- `docs/knowledge-base.md` documentation
- Per-folder storage path configuration via environment variables

### Changed

- `StorageSettings` extended with `KnowledgeBasePaths` and `uploadMaxSizeBytes`
- Storage config auto-resolves monorepo root for `knowledge-base/` path
- Updated `docs/architecture.md`, `docs/folder-structure.md`, `README.md`

## [0.1.0] — 2026-07-27

### Added

- Enterprise folder structure for NestJS backend (`apps/api/src`)
- Enterprise folder structure for Next.js frontend (`apps/web/src`)
- TypeScript path aliases for both applications
- `knowledge-base/` directory with organization README
- Documentation: `architecture.md`, `folder-structure.md`, `development.md`, `deployment.md`, `ai-architecture.md`, `rag-workflow.md`
- Client-friendly HTML documentation at `docs/index.html`
- Root `README.md` with project overview, tech stack, and roadmap
- `.env.example` with multi-provider AI configuration placeholders
- `.gitignore` for Node.js monorepo

### Changed

- Removed default NestJS Hello World controller and service
- Replaced default Next.js starter page with Phase 1 foundation placeholder
- Moved global styles to `apps/web/src/styles/globals.css`
- Updated NestJS e2e tests to verify application bootstrap (no API endpoints)

### Removed

- Default `app.controller.ts`, `app.service.ts`, and `app.controller.spec.ts`
- Default Next.js marketing content and external links from home page

## [0.0.1] — 2026-07-27

### Added

- Initial project scaffold
- NestJS 11 backend (`apps/api`)
- Next.js 16 frontend (`apps/web`)
- `AI_PROJECT_CONTEXT.md` project rules and context
