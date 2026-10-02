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

## Copy this folder to the server

The PDFs stay on your computer. They are not in Git. From the repository root on Windows, upload books and articles that are missing or incomplete on the server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\upload-knowledge-base.ps1
```

The script reads `knowledge-base` next to the repository, not a fixed drive letter. For a different server, set `MCA_SSH_TARGET` (for example `deploy@YOUR_SERVER`) before you run it. When the upload finishes, index the files on the server:

```bash
cd /var/www/medical-causation-ai
npm run reembed:kb:full
```

More server detail is in [DEPLOYMENT.md](../DEPLOYMENT.md). Expert Witness Investigation does not use this folder.

## Indexing

Documents in this directory are parsed, chunked, embedded, and stored in PostgreSQL. They are not stored in Git.

## Important Notes

- Do **not** store PHI (Protected Health Information) in this repository
- Use anonymized or synthetic case data for development and testing
- Large binary files may be excluded from version control via `.gitignore` in production workflows
- Document ingestion will be handled by backend workers (BullMQ) in a future phase
