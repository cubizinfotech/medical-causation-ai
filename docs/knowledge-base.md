# Knowledge Base

## Purpose

The **Knowledge Base** is the private document repository for the Medical Causation AI platform. It stores medical books, research articles, case reports, templates, and uploaded documents that will later be indexed for Retrieval-Augmented Generation (RAG).

This phase implements **document management and discovery only**. Text extraction is handled by the [Document Processing](./document-processing.md) module.

## Folder Structure

```
knowledge-base/
├── books/       # Licensed medical textbooks (PDF)
├── articles/    # Peer-reviewed research papers (PDF) — may contain sub-folders by topic
├── reports/     # Internal reference reports and summaries
├── templates/   # Report and analysis templates (PDF, DOCX, MD, TXT)
└── uploads/     # Staging area for user-uploaded documents
```

Documents in sub-folders are supported. For example:

```
knowledge-base/
└── articles/
    ├── mild tbi/
    │   └── study-2019.pdf
    ├── spine/
    │   └── whiplash-meta-analysis.pdf
    └── stroke articles/
        └── tbi-stroke-risk.pdf
```

The sub-folder path becomes the document **sub-category** (e.g., `mild tbi`).

## Supported File Types

| Extension | MIME Type | Description |
|-----------|-----------|-------------|
| `.pdf` | `application/pdf` | Primary format for medical literature |
| `.docx` | Word document | Templates and reports |
| `.txt` | Plain text | Notes and simple references |
| `.md` | Markdown | Templates and structured text |

All other file types are **ignored** during discovery.

## Document Metadata

Each discovered document produces a `KnowledgeDocument` record:

| Field | Description |
|-------|-------------|
| `id` | Stable SHA-256 hash from path + checksum |
| `title` | Derived from filename |
| `filename` | Original file name |
| `filePath` | Absolute path on disk |
| `relativePath` | Path relative to knowledge base root |
| `extension` | File extension (lowercase) |
| `category` | Knowledge category (Medical Book, Research Article, etc.) |
| `subCategory` | Parent folder within category (e.g., topic folder) |
| `folder` | Top-level folder (books, articles, etc.) |
| `size` | File size in bytes |
| `createdAt` | File system creation time |
| `modifiedAt` | File system modification time |
| `checksum` | SHA-256 hash of file contents |
| `status` | Indexing status (see below) |
| `discoveredAt` | When the scanner last found this file |

## Document Status

| Status | Description |
|--------|-------------|
| `pending` | Discovered, awaiting indexing (default) |
| `indexed` | Successfully indexed in vector database (future) |
| `processing` | Currently being parsed or embedded (future) |
| `failed` | Indexing failed (future) |
| `ignored` | Failed validation, excluded from indexing |

## Knowledge Categories

| Category | Default Folder | Description |
|----------|---------------|-------------|
| Medical Book | `books/` | Licensed textbooks and reference works |
| Research Article | `articles/` | Peer-reviewed journal articles |
| Case Report | `reports/` | Internal and expert reports |
| Template | `templates/` | Report and analysis templates |
| Other | `uploads/` | Unclassified uploads |
| Clinical Guideline | — | Assigned manually in future phases |
| Medical Record | — | Assigned manually in future phases |

## Backend Module

```
apps/api/src/modules/knowledge-base/
├── constants/          # Categories, statuses, supported extensions
├── types/              # TypeScript interfaces
├── interfaces/         # Service contracts
├── entities/           # Entity re-exports (future Prisma models)
├── dto/                # API response DTOs (future endpoints)
├── utils/              # Metadata and validation utilities
├── services/
│   ├── document-discovery.service.ts   # Recursive folder scanner
│   └── knowledge-base.service.ts       # Main management service
├── controllers/        # HTTP controllers (future phase)
└── knowledge-base.module.ts
```

### Key Services

**DocumentDiscoveryService**
- Recursively scans `knowledge-base/` folders
- Detects supported file types
- Reads file metadata and computes SHA-256 checksum
- Does **not** parse document contents

**KnowledgeBaseService**
- `discoverDocuments()` — scan and return all documents
- `listDocuments(options)` — filter, search, paginate
- `getDocument(id)` — retrieve by ID
- `refreshKnowledgeBase()` — full re-scan with add/update/remove tracking
- `validateDocument(doc)` — extension, size, filename, duplicate checks
- `getStats()` — dashboard statistics
- `getSectionSummaries()` — per-folder counts for future UI

## Configuration

Environment variables (see `.env.example`):

```env
KNOWLEDGE_BASE_PATH=./knowledge-base
KNOWLEDGE_BASE_BOOKS_PATH=./knowledge-base/books      # optional override
KNOWLEDGE_BASE_ARTICLES_PATH=./knowledge-base/articles
UPLOAD_MAX_SIZE_MB=50
```

The storage config auto-resolves the monorepo root when running from `apps/api/`.

## Validation Rules

| Rule | Code | Action |
|------|------|--------|
| Supported extension | `UNSUPPORTED_EXTENSION` | Reject / ignore |
| Max file size | `MAX_SIZE_EXCEEDED` | Reject / ignore |
| Invalid filename | `INVALID_FILENAME` | Reject / ignore |
| Duplicate checksum | `DUPLICATE_CHECKSUM` | Warning |
| Empty file | `EMPTY_FILE` | Warning |

## Future Indexing Workflow

```
Document Discovery (this phase)
        │
        ▼
PDF/DOCX Parser (future)
        │
        ▼
Text Chunker (future)
        │
        ▼
Embedding Generator (AiService.embed)
        │
        ▼
PostgreSQL + pgvector Index (future)
        │
        ▼
Status → "indexed"
```

## Future RAG Workflow

```
Attorney Case Query
        │
        ▼
Vector Similarity Search (pgvector)
        │
        ▼
Retrieve Top-K Document Chunks
        │
        ▼
AiService.complete(context + chunks)
        │
        ▼
Causation Analysis with Citations
```

## Frontend (Future UI)

Dashboard sections prepared in `apps/web/src/features/knowledge-base/`:

- **Knowledge Base** — overview with total/pending/indexed counts
- **Books** — medical textbooks
- **Articles** — research papers
- **Reports** — case reports
- **Templates** — document templates
- **Uploads** — staged uploads

Types: `KnowledgeBaseDashboard`, `KnowledgeBaseDashboardStats`, `KnowledgeBaseSectionSummary`

## Related Documentation

- [knowledge-base/README.md](../knowledge-base/README.md) — file organization guidelines
- [RAG Workflow](./rag-workflow.md) — future embedding pipeline
- [AI Architecture](./ai-architecture.md) — AI service integration
- [Architecture](./architecture.md) — system overview
