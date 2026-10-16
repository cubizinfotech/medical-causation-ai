# Knowledge Base

This directory stores private medical reference documents used by the **Medical Causation AI** platform for Retrieval-Augmented Generation (RAG).

These files are **not** part of the application source code. They are source material that will be ingested, chunked, embedded, and indexed into **PostgreSQL + pgvector** so the AI can retrieve relevant scientific evidence during causation analysis.

## Directory Structure

```
knowledge-base/
├── books/       # Licensed medical textbooks and reference books (PDF)
├── originals/   # Large source PDFs before they are split into books or articles
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

`originals/` holds source PDFs that are not yet split into `books/` or `articles/`. Indexing reads that folder too.

## Copy this folder to the server

The PDFs stay on your computer. They are not in Git. From the repository root on Windows, upload books and articles that are missing or incomplete on the server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\upload-knowledge-base.ps1
```

The script reads `knowledge-base` next to the repository, not a fixed drive letter. For a different server, set `MCA_SSH_TARGET` (for example `deploy@YOUR_SERVER`) before you run it. When the upload finishes, index on the server. Closing SSH does not stop it:

```bash
cd /var/www/medical-causation-ai
mkdir -p logs
nohup npm run index:kb > logs/index-kb.log 2>&1 &
tail -f logs/index-kb.log
```

On the laptop, from the repository root:

```bash
npm run index:kb
```

That command reads new files, changed files, and files that failed last time (including scanned PDFs). Files already indexed are skipped. A PDF over 8 MB runs in its own process. Scanned pages are read with OCR. On the 2 GB server, split a book near 1 GB into parts under about 200 MB first. A scan with more than 500 image pages is marked failed until it is split.

`npm run reembed:kb` only replaces embeddings for passages already in the database, after `EMBEDDING_PROVIDER` or `AI_EMBEDDING_MODEL` changes. It does not read new files.

`npm run clear:histories` does not touch this folder. It deletes MCA and EWI case histories only.

More server detail is in [DEPLOYMENT.md](../DEPLOYMENT.md). Generated EWI report PDFs are written under `ewi/reports/` and are not library books.

## Important Notes

- Do not store patient records in this folder. Uploaded records belong in `data/case-records`.
- These PDFs are not in Git.
