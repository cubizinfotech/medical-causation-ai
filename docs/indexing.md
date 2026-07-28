# Indexing Pipeline

## Purpose

The **Indexing Pipeline** transforms processed medical documents into semantic vectors stored in PostgreSQL with pgvector. Indexed chunks become searchable by the future RAG retrieval engine.

This phase implements **indexing only** — no RAG retrieval, report generation, or medical analysis.

## Module Location

```
apps/api/src/modules/indexing/
├── chunking/           # Token-aware ChunkingService
├── embeddings/         # IndexingEmbeddingService (wraps AiService)
├── repositories/       # Prisma repositories for documents, chunks, vectors
├── services/           # IndexingService, stats, job preparation
├── constants/          # Index statuses, job types
├── types/              # Chunk metadata, indexing results, stats
├── interfaces/         # Service contracts
├── exceptions/         # Indexing error hierarchy
├── dto/                # Future API response DTOs
└── controllers/        # Reserved for future HTTP endpoints
```

Database layer: `apps/api/src/database/` (Prisma)

Frontend types: `apps/web/src/features/indexing/`

## Indexing Workflow

```
Knowledge Base Document
        ↓
   Duplicate Check (checksum + modified date)
        ↓
   Document Processing (parse → normalize)
        ↓
   Chunking (token-aware, overlap, metadata)
        ↓
   Embedding Generation (active EMBEDDING_PROVIDER)
        ↓
   Vector Storage (pgvector)
        ↓
   Status Update → Ready For Search
```

### Entry Point

```typescript
const result = await indexingService.indexKnowledgeBaseDocument(documentId);

// Skip duplicate re-indexing when unchanged
const forced = await indexingService.indexKnowledgeBaseDocument(documentId, {
  forceReindex: true,
});

const stats = await indexingService.getStats();
```

## Chunking Strategy

Configured via environment variables (not hardcoded):

| Variable | Default | Description |
|----------|---------|-------------|
| `CHUNK_SIZE_TOKENS` | `512` | Target chunk size in tokens |
| `CHUNK_OVERLAP_TOKENS` | `64` | Overlap between consecutive chunks |
| `CHUNK_MIN_SIZE_TOKENS` | `50` | Minimum chunk size before split |

### Behavior

1. **PDF documents** — chunk page-by-page to preserve `pageNumber`
2. **DOCX / Markdown** — chunk by detected sections when available
3. **Plain text** — chunk full normalized text
4. Splits respect sentence/word boundaries when possible
5. Each chunk carries full metadata (document title, category, source file, order)

### Chunk Metadata

Every chunk includes:

- `chunkId`, `documentId`, `documentTitle`
- `category`, `subCategory`
- `pageNumber`, `section`
- `chunkIndex`, `totalChunks`
- `text`, `estimatedTokens`, `sourceFile`, `createdAt`

## Embedding Providers

Selected via `EMBEDDING_PROVIDER` environment variable:

| Provider | Env Value | Status |
|----------|-----------|--------|
| OpenAI | `openai` | Implemented |
| OpenRouter | `openrouter` | Implemented |
| Gemini | `gemini` | Implemented |
| Voyage AI | `voyage` | Implemented |
| Jina AI | `jina` | Implemented |
| Nomic | `nomic` | Implemented |
| Ollama | `ollama` | Implemented (local) |
| Groq | `groq` | Reserved (future) |

### OpenRouter

Uses the OpenAI-compatible `/embeddings` endpoint with:

- Configurable model via `AI_EMBEDDING_MODEL`
- Retries (`EMBEDDING_RETRY_MAX_ATTEMPTS`)
- Timeout (`EMBEDDING_REQUEST_TIMEOUT_MS`)
- Rate limit handling with backoff
- Structured logging

## Vector Storage

### Prisma Schemas

| Schema | Tables |
|--------|--------|
| `documents` | `indexed_documents`, `document_chunks` |
| `vectors` | `chunk_embeddings` (+ `embedding vector(1536)` column) |

### Duplicate Prevention

- Documents: skip re-index when `checksum` and `fileModifiedAt` unchanged
- Chunks: unique `(documentId, chunkIndex)` and `(documentId, contentHash)`
- Embeddings: one vector per chunk (`chunk_id` unique), upsert on re-index

Re-indexing deletes prior chunks (cascades to embeddings) before inserting new ones.

## Background Jobs

`IndexingJobService` prepares queue-ready job payloads for future BullMQ integration:

```typescript
const job = indexingJobService.createJob({
  knowledgeDocumentId: '...',
  forceReindex: false,
  requestedAt: new Date().toISOString(),
});
await indexingJobService.enqueueJob(job); // logs stub — queue not yet wired
```

## Monitoring

`IndexingStatsService` provides dashboard-ready metrics:

- Total / indexed / pending / processing / failed documents
- Total chunks and embeddings
- Average chunk token size
- Last indexed timestamp

## Configuration

```env
EMBEDDING_PROVIDER=openrouter
AI_EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
EMBEDDING_BATCH_SIZE=100
CHUNK_SIZE_TOKENS=512
CHUNK_OVERLAP_TOKENS=64
DATABASE_URL=postgresql://mca_user:mca_password@localhost:5432/medical_causation_ai
```

## Database Setup

```bash
npm run dev:infra                              # Start PostgreSQL + pgvector
cd apps/api
npx prisma migrate deploy                      # Apply indexing tables
```

## Future RAG Integration

The indexing pipeline produces:

1. `document_chunks` with rich metadata for citation
2. `chunk_embeddings` with pgvector cosine index for similarity search

A future RAG module will:

1. Embed the user query
2. Search `vectors.chunk_embeddings` via pgvector
3. Retrieve associated chunk text and document metadata
4. Pass context to `AiService` for medical causation analysis

## Testing

```bash
cd apps/api
npm run test
```

Unit tests cover chunking utilities and `ChunkingService`. Integration indexing requires PostgreSQL and a configured embedding provider.
