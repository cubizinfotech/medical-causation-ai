# Architecture

## Overview

**Medical Causation AI** is an enterprise SaaS platform that helps personal injury attorneys determine whether trauma or accidents medically contributed to a patient's injury or disease. The system combines scientific literature, private knowledge bases, epidemiological evidence, and AI reasoning to produce attorney-ready causation reports.

This document describes the high-level system architecture established in **Phase 1 (Project Foundation)**.

## Design Principles

- **Clean Architecture** — separation of concerns across layers
- **Feature-based modules** — independent, composable domain modules
- **API-first** — backend exposes REST APIs consumed by the Next.js frontend
- **Multi-tenant ready** — architecture supports law firm isolation from day one
- **Environment-driven configuration** — no hardcoded secrets or magic values
- **Modular AI provider support** — OpenAI, Anthropic, Gemini, Azure OpenAI, OpenRouter

## System Context

```
Attorney (Web UI)
       │
       ▼
  Next.js Frontend (apps/web)
       │
       ▼
  NestJS API (apps/api)
       │
       ├── PostgreSQL + pgvector (cases, embeddings, citations)
       ├── Redis + BullMQ (background jobs)
       ├── External Medical APIs (PubMed, PMC, ClinicalTrials.gov, etc.)
       ├── AI Providers (configurable via environment)
       └── Knowledge Base (knowledge-base/ → RAG index)
```

## Application Flow (Target State)

1. Attorney creates a medical causation case
2. System collects patient and accident information
3. Medical literature search runs against external databases
4. Private knowledge base is queried via RAG (pgvector)
5. AI analyzes retrieved evidence
6. Medical causation engine applies accepted causation principles
7. Probability engine calculates confidence scores
8. Professional PDF report is generated with citations

## Monorepo Structure

```
medical-causation-ai/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/         # Shared packages (types, config, constants)
├── knowledge-base/   # Private documents for RAG ingestion
├── docs/             # Project documentation
├── docker/           # Docker configuration (future)
└── scripts/          # Utility scripts (future)
```

## Backend Architecture (apps/api)

```
src/
├── common/         # Guards, filters, interceptors, decorators
├── config/         # Environment configuration
├── database/       # Prisma schema, migrations, repositories
├── modules/        # Feature modules (knowledge-base, cases, firms, users, etc.)
├── ai/             # AI provider abstraction and prompts
├── medical/        # Causation engine, probability engine
├── integrations/   # PubMed, PMC, Crossref, Semantic Scholar, etc.
├── shared/         # Shared DTOs, types, utilities
├── queues/         # BullMQ job processors
└── utils/          # Pure utility functions
```

## Frontend Architecture (apps/web)

```
src/
├── app/            # Next.js App Router pages and layouts
├── components/     # Reusable UI components
├── features/       # Feature-specific modules (cases, research, reports)
├── hooks/          # Custom React hooks
├── lib/            # Shared libraries and constants
├── providers/      # React context providers
├── services/       # API client services
├── store/          # Client-side state management
├── styles/         # Global styles and Tailwind configuration
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Knowledge Base Module

The `modules/knowledge-base/` module manages document discovery and metadata for the `knowledge-base/` directory:

- **DocumentDiscoveryService** — recursively scans folders, reads metadata, computes checksums
- **KnowledgeBaseService** — list, filter, refresh, validate, and dashboard stats
- Supported types: PDF, DOCX, TXT, MD
- Status tracking: pending → indexed (future)

See [Knowledge Base Documentation](./knowledge-base.md) for full details.

## Document Processing Module

The `modules/document-processing/` module extracts structured text and metadata from knowledge base documents:

- **ParserFactory** — selects parser by file extension (PDF, DOCX, TXT, MD)
- **DocumentProcessingService** — pipeline: validate → parse → normalize → return result
- **PdfParser** — page-by-page extraction via pdfjs-dist with OCR detection
- **DocxParser** — structured sections via mammoth
- Scanned PDF detection via `needsOcr` flag (OCR in future phase)

See [Document Processing Documentation](./document-processing.md) for full details.

## RAG Retrieval Module

The `modules/rag/` module retrieves and prepares knowledge for LLM augmentation:

- **RetrievalService** — hybrid search entry point
- **HybridKnowledgeBaseRetriever** — vector + keyword search with RRF fusion
- **ContextBuilder** — deduplication, token limits, citation assembly
- **RetrieverRegistry** — pluggable multi-source architecture

See [RAG Workflow Documentation](./rag-workflow.md) for full details.

## Medical Analysis Module

The `modules/medical-analysis/` module generates structured causation analysis from retrieved evidence:

- **MedicalAnalysisService** — single entry point (RAG → LLM → structured JSON)
- **MedicalQueryBuilder** — builds retrieval requests from patient case input
- **AnalysisPromptBuilder** — loads template files and injects retrieved context
- **AnalysisSafetyValidator** — rejects empty retrieval and hallucinated citations
- **AnalysisResponseMapper** — maps LLM output to typed result with evidence classification

See [Medical Analysis Documentation](./medical-analysis.md) for full details.

## Implementation Status

The following are **not yet implemented**:

- Authentication and authorization
- Multi-tenant law firm management
- Medical literature search (PubMed, PMC, etc.)
- Professional PDF report generation
- Dedicated full report viewer page (`/report`)
- Remaining REST API endpoints (indexing, RAG, knowledge-base via HTTP)

### Implemented (Phases 1–3)

- Knowledge base document discovery and metadata management
- Document processing pipeline (PDF, DOCX, TXT, Markdown)
- Knowledge indexing pipeline (chunking, embeddings, pgvector)
- RAG retrieval engine (hybrid search, context builder, citations)
- Medical analysis engine (RAG + LLM structured causation reasoning)
- Demonstration UI (landing, case form, analysis workflow)
- `POST /medical-analysis/analyze` API endpoint
- AI provider architecture with LLM and embedding implementations

## Related Documentation

- [Folder Structure](./folder-structure.md)
- [Knowledge Base](./knowledge-base.md)
- [Document Processing](./document-processing.md)
- [Indexing](./indexing.md)
- [Development Guide](./development.md)
- [Deployment Guide](./deployment.md)
- [AI Architecture](./ai-architecture.md)
- [RAG Workflow](./rag-workflow.md)
- [Medical Analysis](./medical-analysis.md)
