# Knowledge Base

This directory stores private medical reference documents used by the **Medical Causation AI** platform for Retrieval-Augmented Generation (RAG).

These files are **not** part of the application source code. They are source material that will be ingested, chunked, embedded, and indexed into **PostgreSQL + pgvector** so the AI can retrieve relevant scientific evidence during causation analysis.

## Directory Structure

```
knowledge-base/
├── books/       # Licensed medical textbooks and reference books (PDF)
├── articles/    # Peer-reviewed articles and research papers (PDF)
├── reports/     # Internal or expert reports and reference summaries
├── templates/   # Report templates and structured reference documents
└── uploads/     # Client-uploaded documents pending processing
```

## Organization Guidelines

### `books/`

Store licensed medical textbooks and authoritative reference works.

- Use descriptive filenames: `Textbook of Traumatic Brain Injury - 3rd Edition.pdf`
- One book per file; avoid bundling unrelated works
- Do not commit copyrighted material unless properly licensed

### `articles/`

Store peer-reviewed journal articles and clinical research papers.

- Group by topic when helpful (e.g., `mild tbi/`, `spine/`, `stroke articles/`)
- Prefer PDFs with searchable text over scanned images
- Include author and year in filenames when possible

### `reports/`

Store internal reference reports, expert summaries, and firm-specific guidance documents.

- Use versioned filenames when documents are updated
- Keep attorney-facing templates separate from source research

### `templates/`

Store structured document templates used for report generation and analysis workflows.

- Markdown, DOCX, or PDF formats are acceptable
- Templates should not contain patient-identifiable information

### `uploads/`

Temporary staging area for documents uploaded by users before ingestion.

- Files here are processed and moved to the appropriate permanent location
- Do not treat this folder as long-term storage

## Future RAG Pipeline

In later phases, documents in this directory will be:

1. **Parsed** — text extracted from PDFs and other formats
2. **Chunked** — split into semantically meaningful segments
3. **Embedded** — converted to vector representations via the configured AI provider
4. **Indexed** — stored in PostgreSQL with pgvector for similarity search
5. **Retrieved** — queried during medical causation analysis alongside PubMed, PMC, and other external sources

## Important Notes

- Do **not** store PHI (Protected Health Information) in this repository
- Use anonymized or synthetic case data for development and testing
- Large binary files may be excluded from version control via `.gitignore` in production workflows
- Document ingestion will be handled by backend workers (BullMQ) in a future phase
