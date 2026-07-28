# Document Processing

## Purpose

The **Document Processing Pipeline** extracts structured text and metadata from medical documents in the knowledge base. It is the foundation for future chunking, embedding, vector indexing, and RAG workflows.

This phase implements **parsing and normalization only** — no chunking, embeddings, pgvector, RAG, AI analysis, or report generation.

## Supported Formats

| Format | Extension | Parser | Output Structure |
|--------|-----------|--------|------------------|
| PDF | `.pdf` | `PdfParser` | Page-by-page text with page numbers |
| Word | `.docx` | `DocxParser` | Headings, paragraphs, tables |
| Plain text | `.txt` | `TxtParser` | Paragraph sections |
| Markdown | `.md` | `MarkdownParser` | Headings and paragraphs |

### Future Formats (Prepared)

| Format | Status |
|--------|--------|
| Images (PNG, JPG) | Planned — OCR pipeline |
| HTML | Planned |
| EPUB | Planned |

Scanned PDFs are detected via low text density; the `needsOcr` flag is set for future OCR fallback.

## Module Location

```
apps/api/src/modules/document-processing/
├── constants/          # Parser types, extensions, OCR thresholds
├── controllers/        # Reserved for future API endpoints
├── dto/                # Response DTOs for future API
├── entities/           # Reserved for future persistence
├── exceptions/         # Reusable processing exceptions
├── interfaces/         # IDocumentParser, IDocumentProcessingService
├── parsers/            # PDF, DOCX, TXT, Markdown parsers + factory
├── services/           # DocumentProcessingService (pipeline entry point)
├── types/              # ProcessedDocumentResult, ProcessedPage, etc.
└── utils/              # Text normalization, metadata extraction
```

Frontend types (no UI, no API):

```
apps/web/src/features/document-processing/
├── types.ts
├── document-processing.service.ts   # Client stubs
└── index.ts
```

## Parser Architecture

Every parser implements the same contract:

```typescript
interface IDocumentParser {
  readonly parserType: ParserType;
  readonly supportedExtensions: readonly string[];
  canParse(extension: string): boolean;
  parse(input: ParserInput): Promise<ParserOutput>;
}
```

The `ParserFactory` selects the correct parser by file extension. Parsing logic is **not duplicated** — each format has a dedicated parser class.

### PDF Parser

- Library: **pdfjs-dist** (Mozilla PDF.js)
- Extracts text **page-by-page** preserving page numbers and reading order
- Processes one page at a time for large medical books
- Detects scanned/low-text PDFs and sets `needsOcr: true`
- Extracts PDF metadata (title, author) when available

### DOCX Parser

- Library: **mammoth**
- Extracts headings, paragraphs, and basic tables
- Converts to structured sections with type and order

### TXT / Markdown Parsers

- UTF-8 text extraction
- Markdown: parses `#` headings into structured sections
- Output normalized via shared text utilities

## Processing Workflow

```
Discover Document
       ↓
   Validate (size, extension, path)
       ↓
   Choose Parser (ParserFactory)
       ↓
   Extract Metadata (file stats + parser output)
       ↓
   Extract Text (pages / sections)
       ↓
   Normalize (whitespace, unicode, line endings)
       ↓
   Return ProcessedDocumentResult
```

### Entry Point

```typescript
// Process any file by path
const result = await documentProcessingService.processDocument({
  filePath: '/absolute/path/to/document.pdf',
  documentId: 'optional-kb-id',
  relativePath: 'articles/mild tbi/study.pdf',
});

// Process a knowledge base document by ID
const result = await documentProcessingService.processKnowledgeBaseDocument(documentId);
```

## Metadata Extraction

Each processed document includes:

| Field | Description |
|-------|-------------|
| `title` | From PDF metadata or filename |
| `filename` | Original file name |
| `extension` | Lowercase extension |
| `fileSize` | Bytes on disk |
| `pageCount` | Number of pages (PDF) |
| `wordCount` | Total words in normalized text |
| `charCount` | Total characters |
| `estimatedTokens` | ~4 chars per token estimate |
| `createdAt` / `modifiedAt` | File system timestamps |
| `author` | From PDF/DOCX metadata when available |
| `language` | Reserved for future detection |
| `needsOcr` | True when PDF appears scanned |

## Text Normalization

Shared utilities in `utils/text-normalization.util.ts`:

- Normalize Unicode (NFKC)
- Strip zero-width and invisible characters
- Normalize line endings (`\r\n` → `\n`)
- Collapse repeated blank lines
- Trim trailing whitespace per line
- Preserve paragraph structure

## Error Handling

| Exception | When |
|-----------|------|
| `UnsupportedFileTypeException` | Extension has no parser |
| `DocumentCorruptedException` | File is unreadable or invalid |
| `DocumentTooLargeException` | Exceeds `KNOWLEDGE_BASE_MAX_FILE_SIZE_MB` |
| `ParsingFailedException` | Parser error during extraction |
| `EmptyDocumentException` | No extractable text after parsing |

## Future OCR Support

When a PDF has very little extractable text:

1. `needsOcr` is set to `true` on metadata
2. A warning is added to `ProcessedDocumentResult.warnings`
3. A future OCR parser (Tesseract, cloud vision) will plug into the same `IDocumentParser` interface

## Configuration

Uses existing storage config from `.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `KNOWLEDGE_BASE_MAX_FILE_SIZE_MB` | `500` | Max file size for processing |
| `KNOWLEDGE_BASE_PATH` | `./knowledge-base` | Root for KB document discovery |

## Dependencies

| Package | Purpose |
|---------|---------|
| `pdfjs-dist` | PDF page-by-page text extraction |
| `mammoth` | DOCX to structured text |

## Testing

```bash
cd apps/api
npm run test
```

Integration tests cover:

- TXT and Markdown parsing (temp files)
- DOCX parsing (generated fixture via `docx` dev dependency)
- PDF parsing (real knowledge base article PDF)
- Metadata and page numbering verification
- Text normalization unit tests

## Next Phase

After document processing:

1. **Chunking** — split `normalizedText` into overlapping chunks
2. **Embeddings** — generate vectors via `AiService`
3. **Vector indexing** — store in pgvector
4. **RAG retrieval** — semantic search over processed documents
5. **API endpoints** — expose processing via REST
