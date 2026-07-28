# RAG Workflow

## Overview

Retrieval-Augmented Generation (RAG) enables the **Medical Causation AI** platform to ground AI analysis in the firm's private medical knowledge base alongside external scientific literature.

This document describes the **RAG retrieval engine** implemented in Phase 2c, integrated with the **Medical Analysis Engine** (Phase 2d) and **Demonstration UI** (Phase 3).

## What is RAG?

RAG combines:

1. **Retrieval** — finding relevant document chunks from a vector index
2. **Augmentation** — injecting retrieved context into the AI prompt
3. **Generation** — producing AI responses grounded in retrieved evidence via `MedicalAnalysisService`

## Current Implementation Status

| Component | Status |
|-----------|--------|
| Document ingestion + chunking + embedding | ✅ Complete |
| Vector storage (pgvector) | ✅ Complete |
| Hybrid retrieval (vector + keyword) | ✅ Complete |
| Re-ranking (score-based default) | ✅ Complete |
| Context builder with citations | ✅ Complete |
| Retrieval logging | ✅ Complete |
| Medical analysis (RAG + LLM) | ✅ Complete |
| Demonstration UI | ✅ Complete |
| PDF report generation | Planned |
| PubMed / external sources | Planned |

## Architecture

```
User Question + Case Context
        ↓
Query Embedding (AiService.embed)
        ↓
Hybrid Retrieval
  ├── Vector Search (pgvector cosine)
  └── Keyword Search (PostgreSQL full-text)
        ↓
Reciprocal Rank Fusion
        ↓
Re-ranking (IReranker)
        ↓
Context Builder (dedupe + token limit)
        ↓
Built Context + Citations → Ready for LLM
```

### Module Location

```
apps/api/src/modules/rag/
├── retrievers/     # IKnowledgeRetriever implementations
├── rerankers/      # IReranker implementations
├── builders/       # ContextBuilder, CitationManager
├── services/       # RetrievalService, RetrievalLoggingService
├── repositories/   # ChunkSearchRepository
└── ...
```

## Retrieval Workflow

### Entry Point

```typescript
const result = await retrievalService.retrieve({
  question: 'Can mild traumatic brain injury increase the risk of stroke?',
  injury: 'Mild traumatic brain injury',
  diagnosis: 'Stroke',
  filters: {
    documentType: 'article',
    category: 'research_article',
  },
});
```

### Input Fields

| Field | Description |
|-------|-------------|
| `question` | Primary user question (required) |
| `patientInformation` | Optional patient context |
| `injury` | Injury / trauma type |
| `diagnosis` | Diagnosis under analysis |
| `symptoms` | Reported symptoms |
| `medicalHistory` | Relevant medical history |
| `filters` | Category, sub-category, page range, document type |
| `conversationContext` | Previous questions/answers (architecture only) |

### Output

| Field | Description |
|-------|-------------|
| `chunks` | Ranked retrieved chunks with scores |
| `context` | Assembled LLM-ready context text |
| `context.citations` | Citation metadata for each chunk |
| `executionTimeMs` | Total retrieval time |

## Hybrid Search

### Vector Search

- pgvector cosine similarity (`<=>` operator)
- Joins `chunk_embeddings` → `document_chunks` → `indexed_documents`
- Minimum similarity threshold via `RAG_MIN_SIMILARITY_SCORE`

### Keyword Search

- PostgreSQL `to_tsvector` / `plainto_tsquery` full-text search
- `ts_rank` scoring for relevance

### Score Fusion

- **Reciprocal Rank Fusion (RRF)** merges vector and keyword results
- Configurable weights: `RAG_VECTOR_WEIGHT`, `RAG_KEYWORD_WEIGHT`

## Retrieval Filters

| Filter | Description |
|--------|-------------|
| `category` | Knowledge category (medical_book, research_article, etc.) |
| `subCategory` | Topic folder (e.g., mild tbi, stroke) |
| `documentType` | Shorthand: book, article, report, template, upload |
| `documentId` | Indexed document UUID |
| `knowledgeDocumentId` | Knowledge base document ID |
| `pageMin` / `pageMax` | Page number range |
| `extension` | File type (pdf, docx, txt, md) |
| `sources` | Knowledge source types (default: internal_kb) |

## Re-ranking

`IReranker` interface supports pluggable re-rankers:

| Provider | Status |
|----------|--------|
| `score` (default) | ✅ Combined hybrid score sorting |
| `cross_encoder` | Architecture stub |
| `cohere` | Architecture stub |
| `jina` | Architecture stub |
| `bge` | Architecture stub |

Configure via `RAG_RERANKER=score`.

## Context Builder

The `ContextBuilder`:

- Sorts chunks by relevance score
- **Removes duplicate content** (normalized text comparison)
- Respects `RAG_MAX_CONTEXT_TOKENS` token budget
- Preserves citation headers with document name and page number
- Maintains chunk order within the token budget

## Citation Strategy

Every retrieved chunk includes:

```
[Source: AMA Guides to the Evaluation of Disease, p. 142, chunk 15]
```

Citation fields: `documentName`, `pageNumber`, `chunkNumber`, `category`, `similarityScore`, `citationText`, `sourceFile`.

These citations will appear in generated attorney reports in a future phase.

## Multi-Source Architecture

Adding a new knowledge source requires only a new `IKnowledgeRetriever` implementation:

| Source | Retriever | Status |
|--------|-----------|--------|
| Internal Knowledge Base | `HybridKnowledgeBaseRetriever` | ✅ |
| PubMed | `PubMedRetriever` | Future |
| PubMed Central | `PmcRetriever` | Future |
| ClinicalTrials.gov | `ClinicalTrialsRetriever` | Future |
| Semantic Scholar | `SemanticScholarRetriever` | Future |
| Crossref | `CrossrefRetriever` | Future |
| WHO / CDC | Future | Future |

Register new retrievers in `RetrieverRegistry` — no changes to `RetrievalService`.

## Conversation Context

Architecture types prepared for future chat:

- `ConversationContext` — previous questions, answers, context
- `ConversationTurn` — role-based turn history

Not yet wired to any chat UI or API.

## Retrieval Logging

`RetrievalLoggingService` tracks:

- Question hash (SHA-256 — no raw patient data)
- Retrieved document and chunk IDs
- Execution time, provider, model
- Estimated context tokens

**Patient information is never logged.**

## Configuration

```env
RAG_TOP_K=10
RAG_VECTOR_TOP_K=20
RAG_KEYWORD_TOP_K=20
RAG_MAX_CONTEXT_TOKENS=8000
RAG_VECTOR_WEIGHT=0.7
RAG_KEYWORD_WEIGHT=0.3
RAG_MIN_SIMILARITY_SCORE=0.25
RAG_RERANKER=score
EMBEDDING_PROVIDER=openrouter
AI_EMBEDDING_MODEL=openai/text-embedding-3-small
```

## Future PubMed Integration

When PubMed is added:

1. Create `PubMedRetriever implements IKnowledgeRetriever`
2. Register in `RetrieverRegistry`
3. Pass `sources: ['internal_kb', 'pubmed']` in retrieval filters
4. `RetrievalService` merges results from all active retrievers

No changes to context builder, citation manager, or re-ranking pipeline.

## Related Documentation

- [Indexing](./indexing.md)
- [Document Processing](./document-processing.md)
- [AI Architecture](./ai-architecture.md)
- [Knowledge Base](./knowledge-base.md)
