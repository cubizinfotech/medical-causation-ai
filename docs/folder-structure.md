# Folder Structure

This document describes the enterprise folder structure for the **Medical Causation AI** monorepo.

## Root Directory

```
medical-causation-ai/
├── apps/
│   ├── api/                  # NestJS backend application
│   └── web/                  # Next.js frontend application
├── packages/
│   ├── config/               # Shared configuration (future)
│   ├── constants/            # Shared constants (future)
│   ├── shared/               # Shared utilities (future)
│   └── types/                # Shared TypeScript types (future)
├── knowledge-base/           # Private documents for RAG
│   ├── books/
│   ├── articles/
│   ├── reports/
│   ├── templates/
│   └── uploads/
├── docs/                     # Project documentation
├── docker/                   # Docker and compose files (future)
├── scripts/                  # Development and deployment scripts (future)
├── .env.example              # Environment variable template
├── README.md                 # Project overview
├── TODO.md                   # Development task tracker
├── CHANGELOG.md              # Version history
└── AI_PROJECT_CONTEXT.md     # AI assistant context and rules
```

## Backend (`apps/api/src`)

| Directory | Purpose |
|-----------|---------|
| `common/` | Cross-cutting concerns: guards, filters, interceptors, pipes, decorators |
| `config/` | Application configuration loaded from environment variables |
| `database/` | Prisma client, migrations, database repositories |
| `modules/` | NestJS feature modules — includes `knowledge-base/` for document management |
| `ai/` | AI provider abstraction, prompt templates, LangChain integration |
| `medical/` | Medical causation engine, probability calculator, epidemiology logic |
| `integrations/` | External API clients (PubMed, PMC, Crossref, Semantic Scholar, CDC, WHO) |
| `shared/` | Shared DTOs, interfaces, enums used across modules |
| `queues/` | BullMQ queue definitions and job processors |
| `utils/` | Pure utility functions with no framework dependencies |

### Backend Path Aliases

| Alias | Maps To |
|-------|---------|
| `@/*` | `src/*` |
| `@common/*` | `src/common/*` |
| `@config/*` | `src/config/*` |
| `@database/*` | `src/database/*` |
| `@modules/*` | `src/modules/*` |
| `@ai/*` | `src/ai/*` |
| `@medical/*` | `src/medical/*` |
| `@integrations/*` | `src/integrations/*` |
| `@shared/*` | `src/shared/*` |
| `@queues/*` | `src/queues/*` |
| `@utils/*` | `src/utils/*` |

### Knowledge Base Module (`apps/api/src/modules/knowledge-base/`)

| Directory | Purpose |
|-----------|---------|
| `constants/` | Categories, statuses, supported extensions, folder mappings |
| `types/` | Document metadata, stats, and list result types |
| `interfaces/` | Service contracts (`IKnowledgeBaseService`, `IDocumentDiscoveryService`) |
| `entities/` | Entity re-exports (future Prisma models) |
| `dto/` | API response DTOs for future HTTP endpoints |
| `utils/` | Metadata derivation, validation, checksum utilities |
| `services/` | `DocumentDiscoveryService`, `KnowledgeBaseService` |
| `controllers/` | HTTP controllers (future phase) |

## Frontend (`apps/web/src`)

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router: layouts, pages, route groups |
| `components/` | Reusable UI components (buttons, forms, tables, modals) |
| `features/` | Feature modules with co-located components, hooks, and services |
| `hooks/` | Custom React hooks |
| `lib/` | Shared libraries, constants, and configuration helpers |
| `providers/` | React context providers (auth, theme, query client) |
| `services/` | API client services for backend communication |
| `store/` | Client-side state management |
| `styles/` | Global CSS, Tailwind theme extensions |
| `types/` | Frontend TypeScript type definitions |
| `utils/` | Utility functions (formatting, class names, validation helpers) |

### Frontend Path Aliases

| Alias | Maps To |
|-------|---------|
| `@/*` | `src/*` |
| `@/components/*` | `src/components/*` |
| `@/features/*` | `src/features/*` |
| `@/hooks/*` | `src/hooks/*` |
| `@/lib/*` | `src/lib/*` |
| `@/providers/*` | `src/providers/*` |
| `@/services/*` | `src/services/*` |
| `@/store/*` | `src/store/*` |
| `@/styles/*` | `src/styles/*` |
| `@/types/*` | `src/types/*` |
| `@/utils/*` | `src/utils/*` |

### Knowledge Base Feature (`apps/web/src/features/knowledge-base/`)

| File | Purpose |
|------|---------|
| `constants.ts` | Categories, statuses, folder labels |
| `types.ts` | Document and dashboard types for future UI |
| `knowledge-base.service.ts` | `KnowledgeBaseClient` API stubs |
| `index.ts` | Public exports |

### Document Processing Module (`apps/api/src/modules/document-processing/`)

| Directory | Purpose |
|-----------|---------|
| `constants/` | Parser types, processable extensions, OCR thresholds |
| `types/` | `ProcessedDocumentResult`, `ProcessedPage`, metadata types |
| `interfaces/` | `IDocumentParser`, `IDocumentProcessingService` |
| `parsers/` | PDF, DOCX, TXT, Markdown parsers + `ParserFactory` |
| `services/` | `DocumentProcessingService` pipeline |
| `utils/` | Text normalization and metadata extraction |
| `exceptions/` | Processing error hierarchy |
| `dto/` | Response DTOs for future API |
| `controllers/` | HTTP controllers (future phase) |

### Document Processing Feature (`apps/web/src/features/document-processing/`)

| File | Purpose |
|------|---------|
| `types.ts` | `ProcessedDocument`, `ProcessedPage`, job status types |
| `document-processing.service.ts` | `DocumentProcessingClient` API stubs |
| `index.ts` | Public exports |

### Indexing Module (`apps/api/src/modules/indexing/`)

| Directory | Purpose |
|-----------|---------|
| `chunking/` | Token-aware `ChunkingService` |
| `embeddings/` | `IndexingEmbeddingService` (wraps AiService) |
| `repositories/` | Prisma repos for documents, chunks, vectors |
| `services/` | `IndexingService`, stats, job preparation |
| `constants/` | Index statuses, job types |
| `types/` | Chunk metadata, indexing results, stats |
| `interfaces/` | Service contracts |
| `exceptions/` | Indexing error hierarchy |
| `dto/` | Response DTOs for future API |

### Database (`apps/api/src/database/`)

| File | Purpose |
|------|---------|
| `database.module.ts` | Global Prisma module |
| `prisma.service.ts` | Prisma client lifecycle |

### Indexing Feature (`apps/web/src/features/indexing/`)

| File | Purpose |
|------|---------|
| `types.ts` | Indexed document, chunk, embedding, stats types |
| `indexing.service.ts` | `IndexingClient` API stubs |
| `index.ts` | Public exports |

### RAG Module (`apps/api/src/modules/rag/`)

| Directory | Purpose |
|-----------|---------|
| `retrievers/` | `HybridKnowledgeBaseRetriever`, `RetrieverRegistry` |
| `rerankers/` | `IReranker` implementations and registry |
| `builders/` | `ContextBuilder`, `CitationManager` |
| `services/` | `RetrievalService`, `RetrievalLoggingService` |
| `repositories/` | `ChunkSearchRepository` (vector + keyword SQL) |
| `types/` | Retrieval request/result, citations, conversation context |
| `interfaces/` | `IKnowledgeRetriever`, `IReranker`, `IContextBuilder` |

### RAG Feature (`apps/web/src/features/rag/`)

| File | Purpose |
|------|---------|
| `types.ts` | Retrieved document, chunk, citation types |
| `rag.service.ts` | `RagClient` API stubs |
| `index.ts` | Public exports |

### Medical Analysis Module (`apps/api/src/modules/medical-analysis/`)

| Directory | Purpose |
|-----------|---------|
| `prompts/` | Template files (system, analysis, evidence, JSON) |
| `builders/` | `MedicalQueryBuilder`, `AnalysisPromptBuilder` |
| `validators/` | `AnalysisSafetyValidator`, `AnalysisResponseMapper` |
| `services/` | `MedicalAnalysisService` (entry point) |
| `types/` | Request/result schemas, evidence classification |
| `interfaces/` | `IMedicalAnalysisService` |

### Medical Analysis Feature (`apps/web/src/features/medical-analysis/`)

| File | Purpose |
|------|---------|
| `types.ts` | Medical analysis result types aligned with API |
| `medical-analysis.service.ts` | `MedicalAnalysisClient` HTTP client |
| `index.ts` | Public exports |

### Demo Feature (`apps/web/src/features/demo/`)

| Path | Purpose |
|------|---------|
| `schemas/case-form.schema.ts` | Zod validation schema |
| `storage/case-storage.ts` | Session storage helpers |
| `hooks/use-medical-analysis.ts` | TanStack Query mutation hook |
| `constants.ts` | Progress steps, form options |

### Demo Pages (`apps/web/src/app/`)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Landing page |
| `/case` | `case/page.tsx` | Medical case intake form |
| `/analysis` | `analysis/page.tsx` | AI processing screen |

## Knowledge Base (`knowledge-base/`)

| Directory | Purpose |
|-----------|---------|
| `books/` | Licensed medical textbooks (PDF) |
| `articles/` | Peer-reviewed research articles (PDF) |
| `reports/` | Internal reference reports and summaries |
| `templates/` | Report and analysis templates |
| `uploads/` | Staging area for user-uploaded documents |

See [knowledge-base/README.md](../knowledge-base/README.md) for organization guidelines.

## Naming Conventions

- **Files**: `kebab-case.ts` for modules, `PascalCase.tsx` for React components
- **Directories**: `kebab-case` or `camelCase` matching existing NestJS/Next.js conventions
- **Feature modules**: one directory per domain feature under `modules/` (backend) and `features/` (frontend)
- **Tests**: co-located `*.spec.ts` (backend) or `*.test.tsx` (frontend)

## Related Documentation

- [Architecture](./architecture.md)
- [Development Guide](./development.md)
