# Document Processing

**Current status.** Parsing, OCR fallback for scanned PDFs/images, Bates detection, and storage policy checks are implemented. The indexing pipeline consumes processed text. EWI builds evidence references on top of this module.

## Purpose

The **Document Processing Pipeline** extracts structured text and metadata from documents (knowledge base and EWI evidence uploads).

## Supported Formats

| Format | Extension | Parser | Output Structure |
|--------|-----------|--------|------------------|
| PDF | `.pdf` | `PdfParser` | Page-by-page text with page numbers |
| Word | `.docx` | `DocxParser` | Headings, paragraphs, tables |
| Plain text | `.txt` | `TxtParser` | Paragraph sections |
| Markdown | `.md` | `MarkdownParser` | Headings and paragraphs |
| Images | `.png` `.jpg` `.jpeg` `.tif` `.tiff` `.webp` | `ImageParser` | Single page → OCR |

Scanned PDFs are detected via low text density (`needsOcr`). When `OCR_AUTO=true`, the configured OCR provider runs. Failures set `ocrStatus: failed` and do not invent text.

## OCR

| Setting | Values |
|---------|--------|
| `OCR_PROVIDER` | `mock` (default, tests/dev) · `disabled` |
| `OCR_AUTO` | `true` (default) · `false` |

Providers implement `IOcrProvider`. Inject additional engines later without changing callers.

## Bates stamps

`detectBatesNumbers` extracts Bates-like tokens from collected text only. Numbers are never fabricated. Detected values attach to pages and evidence references.

## Storage policy

`evaluateDocumentStorage` enforces:

- LexisNexis / Westlaw PDFs: **rejected** (no file, no extracted body)
- Restricted access: **metadata only**
- Public documents: store only when permissions allow

## Module Location

```
apps/api/src/modules/document-processing/
├── constants/
├── ocr/                 # OcrService, mock/disabled providers
├── parsers/             # PDF, DOCX, TXT, Markdown, Image
├── services/            # DocumentProcessingService
├── types/               # ProcessedDocumentResult (+ Bates, OCR, page refs)
└── utils/               # Bates detection, storage policy, normalization
```

EWI evidence layer:

```
apps/api/src/modules/ewi/documents/
├── ewi-evidence-reference.types.ts   # document/page/Bates/URL/evidence ID
├── ewi-document-intake.service.ts    # ingest + duplicates
└── ewi-report-reference.service.ts   # TOC / searchable report refs
```

## Evidence reference model (EWI)

Each important finding can link to:

- `documentId`
- `pageNumber` (only when observed)
- `batesNumber` (only when detected)
- `sourceUrl`
- `evidenceId`

`EwiReportReferenceService` builds a 40-section TOC index with Bates and page search maps.

## Processing Workflow

```
Discover Document
       ↓
   Validate (size, extension, path)
       ↓
   Storage policy (Lexis / restricted / public)
       ↓
   Choose Parser (ParserFactory)
       ↓
   Extract Text (pages / sections)
       ↓
   OCR when needsOcr (configured provider)
       ↓
   Detect Bates + preserve page refs
       ↓
   Normalize → ProcessedDocumentResult
```

## Tests

- Scanned PDF OCR detection and completion
- OCR failure marking
- Bates detection (and no fabrication)
- Page references preserved / not invented for TXT
- Corrupted PDF rejection
- Duplicate intake by checksum
- Lexis storage rejection
- Report TOC Bates/page search

```bash
cd apps/api
npm test -- src/modules/document-processing src/modules/ewi/documents
```
