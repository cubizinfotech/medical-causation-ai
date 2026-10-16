# Changelog

All notable changes to the **Medical Causation AI** platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added (2026-10-16): Export Word for MCA and EWI reports

- **Export Word** sits next to the PDF button on a finished MCA analysis (`/mca/histories/:id`) and a finished EWI investigation (`/ewi/histories/:id`). The Word file has the PDF report's layout: a cover box with the case or expert details, the executive summary, and the count badges; a contents list (Word offers to fill in the page numbers when the file opens); one titled section per card, with records, evidence, and questions in bordered boxes; clickable source links (web and mail links only); the disclaimer; page numbers.
- The file is built on the server from the saved analysis or investigation each time it is exported, and is not stored. Only the owner can export it (`GET /medical-analysis/histories/:id/report/word`, `GET /ewi/histories/:id/report/word`); an analysis or investigation that has not finished is refused.
- MCA's Word report follows the on-screen report section by section (template `mca/causation-report` 1.0.0), from the evidence basis through the cross-examination questions, the legal disclaimer, and the terms. EWI's uses the same 41-section template as the PDF.
- Control characters from scanned or external sources are removed before writing, since Word rejects them.
- MCA "Published Medical Literature" said the studies "were not used by the AI analysis" even when a supplemented analysis had been given their abstracts as citable sources. It now says which applies, on screen and in Word.

### Changed (2026-10-15): EWI report is a PDF laid out like the MCA report

- The EWI report download is now a PDF instead of a Word file, laid out like the MCA report's PDF: a cover card with the expert's name, details (sections 1–4), the executive summary, and counts; a contents list whose page numbers link to each section; one card per section with its icon, records and cross-examination questions in boxes, and a "(continued)" header when a card runs onto the next page; a disclaimer card; page numbers in the footer.
- Unlike the MCA export (a picture of the page), the EWI PDF is built on the server as text: it can be searched and copied, source links are clickable, and long reports (400+ questions, 60 pages) render without browser limits. Only web and mail links are clickable; any other link is printed as plain text.
- Report template 3.0.0. A Word report saved before this change is rebuilt as a PDF the first time it is downloaded: the `.docx` file is replaced by a `.pdf` and the report record (name, type, path) is updated. If the rebuild fails, the saved Word file is sent.
- The browser saves the download under the name the server sends, so an older investigation still listed with a `.docx` name downloads as `.pdf`. Buttons and page text say "PDF report".
- The cover summary no longer repeats the subject line, the counts, or the disclaimer; they are in the cover details, the count badges, and the disclaimer card.
- New API dependency: `pdfkit` (and `@types/pdfkit` for development). The font is Liberation Sans from `pdfjs-dist`, which the API already ships, so no font files were added. The deploy's `npm ci` installs it; no environment change is needed. The shared Word renderer was removed; the MCA demand letter keeps its own Word builder.

### Changed (2026-10-15): EWI report without a "could not verify" line per source

- The EWI Findings tab and the Word report no longer list a line for every source that returned nothing ("Could not verify web. web_search did not return a usable record. Nothing was inferred."). An investigation that found nothing says so in one sentence; the Sources tab still lists every source and its status.
- Findings tab: analysis cards are shown only for sections with collected findings. Empty tabs use plain wording ("No legal matters were found in the sources searched.").
- Word report (template 2.2.0): empty sections show "No records for this section were found in the sources searched.", without the extra notes about unavailable sources, and Overall Findings no longer adds a "Gap […]" line per source. A report saved with an older template is rebuilt from the stored investigation when it is downloaded, so existing reports get the new wording too.
- Saved summaries are cleaned when shown, so investigations made before this change also display without those lines.

### Fixed (2026-10-15)

- `npm run reembed:kb:full` stopped with "No stored chunks found for re-embedding" at a scanned PDF with no readable text, leaving every later document without embeddings. Re-embedding now skips documents with no passages and continues after a failed document (it lists the failures; run `npm run reembed:kb` again to retry them).
- A file whose text cannot be read (a scan OCR did not read) is now marked `failed` with that reason, instead of `indexed` with 0 passages.
- `npm run index:kb -- --only <text>` from the repository root ignored `--only` and indexed the whole library: npm read it as its own option. The root script now passes arguments through.

### Added (2026-10-15)

- Scanned library PDFs are now read with OCR while indexing, using the Tesseract engine already used for uploaded medical records (on this server; nothing is sent elsewhere). Before, library indexing only had a placeholder OCR, so scans failed with "No readable text". Pages that already have text are kept; a page OCR cannot read stays empty. `OCR_PROVIDER` (`tesseract` by default, or `disabled`), `OCR_MAX_PAGES` (default 500; a larger scan is skipped with a message to split it), and `OCR_DPI` (default 200).

### Fixed (2026-10-14): MCA analyses failing with "No retrieved evidence available"

- Library search found nothing for four reasons, all fixed:
  - **Embedding model mismatch.** The library vectors were made with `openrouter/text-embedding-3-small` and the queries with `gemini/gemini-embedding-2`. Both have 768 dimensions, so nothing failed, but scores between the two models are meaningless. Vector search now compares only vectors of the query's model, skips the paid embedding call when none exist, and logs `Library vectors were made with … run npm run reembed:kb`.
  - **Keyword search required every word of the case** (`plainto_tsquery` over the whole case text) and matched no passage. It now searches for any of the case's medical terms (`websearch_to_tsquery`, ranked with `ts_rank_cd`).
  - **The vector index was built on an empty table.** Its ivfflat list centres were random, and with one probe it returned only 1–3 of the true 20 nearest passages. Migration `20261014120000_hnsw_vector_index` replaces it with HNSW (20 of 20 in the same test) and indexes `(provider, model)`.
  - **Indexing stopped at the first failing file.** `index:kb` gave up at the 1.2 GB DeJong book (over the size limit), so the other books and all 433 articles were never indexed. It now reports a failed file and continues. PDFs containing NUL characters (rejected by PostgreSQL) and PDFs that repeat a passage word for word also failed; both are fixed, for case records too.
- `npm run reembed:kb` now replaces vectors from another provider or model in place, a batch at a time, so search keeps working while it runs. Gemini embeddings go up to 100 texts per API call instead of one call per passage: 1,481 passages took 71 seconds.
- An analysis no longer fails when the library has little on the question. With fewer than `RAG_MIN_RELEVANT_CHUNKS` relevant passages (similarity at least `RAG_RELEVANCE_MIN_SIMILARITY`, set per model), it plans PubMed queries with a short AI call, gives the abstracts to the model as citable `pmid-N` sources, and lets the model use general medical knowledge in a separate, labelled list. Without any cited library passage or study, the confidence score is capped at 39 and a limitation says why.
- Library search that fails (embedding outage, database error) falls back to keyword search or to the supplemented analysis instead of failing the job.
- The causation analysis has its own output budget (`MCA_ANALYSIS_MAX_TOKENS`, default 8,192): `AI_MAX_TOKENS=3000` cut long answers off. A cut-off answer is retried with a request to shorten it, not resent as is.
- EWI: the AI wording of the report was always discarded. The answer was cut off at 8,192 tokens (now `EWI_ANALYSIS_MAX_TOKENS`, default 24,576), same-meaning status spellings were rejected, and asking for exactly 100 questions often returned 98. The checks against collected evidence are unchanged.
- EWI CV check and analysis prompts were not found when the API started outside `apps/api`; the prompt folder is now also found next to the compiled code.

### Added (2026-10-14)

- MCA report sections: **Evidence Basis** (library passages, PubMed abstracts, client records, general knowledge), **Alternative Explanations** (each marked cited evidence or AI reasoning), and **Uncited AI Reasoning**. Cited evidence shows its source (Firm library, PubMed with a link, Client record).
- Prompts state that timing alone does not establish causation and require alternative explanations. Links, PMIDs, and DOIs the model writes that are not among its sources are removed.
- `npm run check:retrieval [question]`: runs sample searches and prints coverage and scores (titles only). `npm run index:kb -- --only <text>` indexes matching files only.

### Changed (2026-10-14)

- Failed analyses and investigations show a plain message ("The AI service is busy…", "…is not set up correctly… contact your administrator", "…took too long to respond") instead of the internal error, which goes to the log with API keys removed. The analysis page no longer shows developer hints. Older saved failures with technical text show a generic message.
- Gemini: a request that cannot succeed (bad key, unknown model, invalid request) is not resent; an overloaded model (503) or dropped connection is retried once even with `AI_RETRY_MAX_ATTEMPTS=1`; Google's requested wait is honoured on a rate limit; a used-up daily quota is not retried. A search query tries its embedding at most twice (indexing keeps `EMBEDDING_RETRY_MAX_ATTEMPTS`).
- The analysis log no longer includes the first 80 characters of the medical question. The retrieval log is capped at 200 entries in memory.

### Security (2026-10-12)

- Removed the synchronous `POST /medical-analysis/analyze` (it could read another user's uploaded records by id) and `POST /ewi/investigate`. The worker now loads records only through the analysis they are attached to.
- Login is always required (`AUTH_ENABLED`/`FEATURE_AUTH` and `GET /auth/status` removed). `JWT_SECRET` must be 32+ characters; tokens last 12 hours, carry an id, and `POST /auth/logout` revokes them. Unknown emails take as long to reject as wrong passwords.
- Rate limits (`@nestjs/throttler`): 300 requests a minute by default, 10 logins, 10 job starts, 30 uploads; plus `JOB_DAILY_LIMIT_PER_USER` paid jobs per day.
- Audit log `platform.audit_events`: sign-ins, failed sign-ins, sign-outs, and views, downloads, and deletes of analyses, records, CVs, reports, and demand letters.
- Security headers: helmet on the API, a frame-blocking CSP and related headers on the website, `X-Frame-Options` and HSTS `includeSubDomains` in Caddy. WebSocket CORS limited to the website origins; the API trusts only the local proxy for client addresses.
- Download file names are sanitized in every `Content-Disposition` header.
- EWI request approvals record the signed-in user, never a name from the request body.
- Login redirect accepts only paths on the site (`//evil.example` is refused). Sign-in and sign-out clear the previous user's data from the browser; a 401 ends the session.
- Demo seed no longer contains real addresses, never overwrites an existing account, and needs `DEMO_USER_PASSWORD` in production. New `npm run user:create`.
- Redis requires `REDIS_PASSWORD` when it is set. PM2 binds to `BIND_HOST` (use `127.0.0.1` behind Caddy). Backups are encrypted with GPG when configured and only encrypted backups leave the server.
- External research requests follow redirects only on the same HTTPS host. The unused research URL helper was removed.
- CI runs lint, type check, tests, and build before deploying, and the deploy checks the server's SSH host key (`DEPLOY_KNOWN_HOSTS`).

### Fixed (2026-10-12)

- EWI CV check: a CV whose text was read correctly showed "The CV could not be read" when the AI provider answered with a rate limit. AI calls inside background jobs (CV claims, EWI analysis, MCA analysis, chronology, bills) now wait the time the provider asks for, up to a minute, and try three times. A failed CV section now says the AI provider was busy instead of blaming the PDF.
- New `AI_FALLBACK_PROVIDER`: when the main provider refuses a call (rate limit, no quota or credits, bad key, outage), the request goes to this provider.

- Deleting an EWI investigation now removes its Word report file and its queued job; a running job stops. A job deleted or cancelled mid-run no longer writes a report or flips back to completed.
- Job progress updates in Redis are atomic, so a cancel and a progress write can no longer overwrite each other.
- A failed EWI queue add marks the investigation failed instead of leaving it pending forever; request errors such as "CV not found" keep their real status instead of becoming 500.
- Two analyses started at once with the same records: the second now fails cleanly instead of reading records owned by the first.
- The staged-upload limit holds under parallel uploads (per-user lock).
- PDF uploads check the page limit before reading any text, and pdf.js documents are released after parsing (memory leak).
- Long jobs are no longer taken for stalled and run (and billed) twice; worker lock and concurrency come from `JOB_*` settings.
- AI JSON retries no longer grow the prompt on every attempt (3 attempts, each with only the latest correction).
- History lists read all running jobs from Redis in one call and write only rows that changed.
- Staged-upload cleanup runs hourly instead of on every upload.
- Keyword search has a full-text index (`document_chunks_text_search_idx`).
- `accidentDate` has a length limit; ids in URLs must be UUIDs.

### Removed (2026-10-12)

- Legacy re-export folders and redirect pages (`components/demo`, `components/report`, `features/demo`, `features/medical-analysis`, `/analysis`, `/case`, `/histories`, `/report`), the unused web AI client, unused API barrels and DTOs, empty `common`/`shared`/`utils`/`queues`/`medical` folders, Storage/Search scaffold modules, unused feature-flag and logging settings, the Passport JWT strategy, `check-embeddings.cjs`, and `run-medical-analysis.ts`.
- The hard-coded server IP in the website and `next.config.ts` (`WEB_DEV_ORIGINS` replaces it).

### Added

- EWI live research (`RESEARCH_PROVIDER=live`): NPI Registry identity check (optional NPI on the intake form), CMS Open Payments totals by the confirmed NPI, OpenAlex publications with strict author matching, and CourtListener opinions with Daubert/Frye/Rule 702 challenges. Rulings are recorded only from quoted court text.
- EWI report section 27 "Daubert/Frye Challenges" (template `2.1.0`, 41 sections) and an identity block in Expert Background.

### Changed

- Guides consolidated to `README.md`, `TODO.md`, `DEMO_GUIDE.md`, `DEPLOYMENT.md`, `docs/how-it-works.md`, and `docs/index.html`.

### Added

- Common platform scaffolds under `apps/api/src/platform/` (auth, users, email, audit, report, storage, search, jobs)
- `modules/common` Nest facade for shared document/RAG modules
- Frontend MCA boundary: `features/mca`, `components/mca` (legacy paths re-export)
- `@platform/*` TypeScript path alias

### Added

- Dual-product architecture: **MCA** (Medical Causation Analysis) + **EWI** (Expert Witness Investigation)
- Backend boundaries: `modules/mca/`, `modules/ewi/`, `platform/`, `integrations/expert-research/`
- EWI vertical slice: intake → BullMQ job → mock research → discrepancies → 100+ questions → Word (.docx) report
- EWI API `/ewi/*` + WebSocket namespace `/ewi`
- EWI investigation lifecycle in schema `ewi`: expert, investigation status/progress, profile, sources, findings, discrepancies, questions, report file, and audit events. Restricted sources store metadata and links only.
- EWI research provider catalog behind `ExpertResearchService`. Local mock fixtures. Live adapters are not connected.
- EWI investigation workflow runs the research stages automatically in the background job, records stage outcomes, and retries transient source failures.
- EWI AI analysis interprets collected findings through `AiService` and registered prompts. Malformed or unsupported model output is discarded. Source findings and analysis JSON are stored separately.
- EWI Word reports use the shared `docx` renderer and the EWI section template `ewi/investigation-report` `1.0.0`. Cross-examination questions cite collected findings and are omitted when none exist.
- Product corpus column on indexed documents; separate KB path config for MCA/EWI
- Frontend product chooser at `/`; MCA under `/mca/*`; EWI under `/ewi/*`; legacy MCA redirects

### Changed

- Relocated medical analysis module to `apps/api/src/modules/mca/medical-analysis/`
- Redis/BullMQ prefixes documented as `{mca-bull}` / `{ewi-bull}`

### Added

- Case history delete — `DELETE /medical-analysis/histories/:id` with confirmation dialog in UI
- PDF report export (replaces Markdown export) with terms & policy footer
- Human-readable private knowledge base source summaries in reports
- Client demo guide with step-by-step presentation flow ([DEMO_GUIDE.md](./DEMO_GUIDE.md))

### Changed

- Updated README, frontend-demo, and medical-analysis docs to reflect current features
- Analysis completion redirects to `/histories/{caseId}` instead of session-only report
- Session cache cleanup utilities for demo flow

### Removed

- Deprecated frontend `useMedicalAnalysis` hook and sync `analyze()` client method
- Unused `loadUploadedFileNames()` session storage helper

### Added

- Final demonstration review — validation fixes, documentation, demo/deployment guides
- `DEMO_GUIDE.md` and `DEPLOYMENT.md` at project root
- Root `npm run validate` script for full CI-style checks
- Test mock helper for `RetrievalResult`
- Removed unused `@radix-ui/react-select` dependency
- Removed duplicate `apps/web/package-lock.json`

### Added

- Phase 3 Demonstration UI — landing page, case form, analysis workflow
- `POST /medical-analysis/analyze` REST endpoint with validation
- Frontend pages: `/`, `/case`, `/analysis`
- React Hook Form + Zod case validation
- TanStack Query API integration
- Reusable demo components and Shadcn-style UI primitives
- `docs/frontend-demo.md`

### Added

- Phase 2d Medical Analysis Engine — RAG + LLM structured causation reasoning
- `apps/api/src/modules/medical-analysis/` module
- Prompt templates for system, analysis, evidence evaluation, and JSON output
- Evidence classification (supporting, opposing, neutral, unknown)
- Confidence score with safety disclaimer
- Citation validation to prevent hallucinated references
- LLM provider HTTP implementations (OpenRouter, OpenAI, Claude, Gemini, Groq)
- Frontend `apps/web/src/features/medical-analysis/` types and stubs
- `docs/medical-analysis.md`

### Added

- Phase 2c RAG Retrieval Engine — hybrid search, context builder, citations
- `apps/api/src/modules/rag/` module
- Hybrid retrieval (pgvector + PostgreSQL full-text search)
- Re-ranking interface with score-based default
- Context builder with deduplication and token limits
- Citation manager for report-ready references
- Multi-source retriever architecture
- Frontend `apps/web/src/features/rag/` types and stubs
- Updated `docs/rag-workflow.md`

### Added

- Phase 2b Knowledge Indexing Pipeline — chunking, embeddings, pgvector
- `apps/api/src/modules/indexing/` module
- Prisma ORM with `documents` and `vectors` schemas
- Token-aware chunking with configurable size and overlap
- Embedding provider implementations including OpenRouter
- `IndexingService`, duplicate detection, indexing stats
- Frontend `apps/web/src/features/indexing/` types and stubs
- `docs/indexing.md`

### Added

- Phase 2 Document Processing Foundation — parsing pipeline
- `apps/api/src/modules/document-processing/` module
- PDF parser (pdfjs-dist) with page-by-page extraction and OCR detection
- DOCX parser (mammoth) with headings, paragraphs, and tables
- TXT and Markdown parsers with text normalization
- `DocumentProcessingService` pipeline entry point
- Metadata extraction (word count, estimated tokens, page count, file stats)
- Reusable processing exceptions
- Frontend `apps/web/src/features/document-processing/` types and client stubs
- `docs/document-processing.md`

### Added

- Phase 1 infrastructure — Docker environment
- `docker-compose.yml` and `docker-compose.dev.yml` with all services
- Multi-stage Dockerfiles for NestJS (`docker/api/`) and Next.js (`docker/web/`)
- PostgreSQL 17 initialization scripts with pgvector, `uuid-ossp`, `pg_trgm` extensions
- PostgreSQL schemas: `app`, `documents`, `vectors` (no tables)
- Redis configuration (`docker/redis/redis.conf`) for caching and future BullMQ queues
- Backend configuration modules: `AppConfig`, `DatabaseConfig`, `RedisConfig`, `AIConfig`, `StorageConfig`, `LoggingConfig`, feature flags
- `@nestjs/config` integration with global `AppConfigModule`
- Frontend centralized configuration (`apps/web/src/lib/config/`)
- Root `package.json` with npm workspaces and Docker/dev scripts
- Comprehensive `.env.example` with grouped sections and comments
- Configuration unit tests (`configuration.spec.ts`)

### Changed

- `main.ts` uses `ConfigService` instead of direct `process.env` access
- `next.config.ts` enables `output: "standalone"` for Docker production builds
- Updated `README.md`, `docs/development.md`, `docs/deployment.md` with Docker workflows
- Frontend `layout.tsx` and `page.tsx` use centralized `lib/config`

### Added

- Phase 1 AI Foundation — provider-agnostic AI architecture
- `apps/api/src/ai/` module with LLM and embedding provider interfaces
- LLM provider stubs: OpenRouter, OpenAI, Anthropic, Gemini, Groq
- Embedding provider stubs: OpenAI, Gemini, Voyage, Jina, Nomic, Ollama
- `AiService` as single entry point for all AI operations
- `PromptService` with file-based template loading and `{{variable}}` substitution
- Prompt templates in `system/`, `medical/`, `reports/`, `testing/` categories
- AI configuration classes: ProviderConfig, EmbeddingConfig, PromptConfig, TokenConfig
- AI exception hierarchy (ProviderUnavailable, InvalidModel, RateLimitExceeded, etc.)
- Token usage types (promptTokens, completionTokens, estimatedCostUsd, executionTimeMs)
- Frontend `AiClient` service layer in `apps/web/src/services/ai/`
- AI architecture unit tests

### Changed

- Default LLM provider changed from `openai` to `openrouter`
- `AISettings` refactored to extend `ProviderConfigSettings` with `activeProvider` field
- `RootConfig` extended with `embedding`, `prompt`, and `token` configuration sections
- Updated `docs/ai-architecture.md` with full architecture documentation
- Updated `.env.example` with embedding providers, prompt config, and token limits

### Added

- Phase 1 Knowledge Base Foundation — document management architecture
- `modules/knowledge-base/` NestJS module with discovery and management services
- Recursive document scanner for `knowledge-base/` (PDF, DOCX, TXT, MD)
- Document metadata model with checksum, category, sub-category, status
- Validation utilities: extension, size, filename, duplicate detection
- Dashboard stats types (`KnowledgeBaseStats`, `KnowledgeBaseSectionSummary`)
- Frontend `features/knowledge-base/` with types and client stubs
- `docs/knowledge-base.md` documentation
- Per-folder storage path configuration via environment variables

### Changed

- `StorageSettings` extended with `KnowledgeBasePaths` and `uploadMaxSizeBytes`
- Storage config auto-resolves monorepo root for `knowledge-base/` path
- Updated `docs/architecture.md`, `docs/folder-structure.md`, `README.md`

## [0.1.0] — 2026-07-27

### Added

- Enterprise folder structure for NestJS backend (`apps/api/src`)
- Enterprise folder structure for Next.js frontend (`apps/web/src`)
- TypeScript path aliases for both applications
- `knowledge-base/` directory with organization README
- Documentation: `architecture.md`, `folder-structure.md`, `development.md`, `deployment.md`, `ai-architecture.md`, `rag-workflow.md`
- Client-friendly HTML documentation at `docs/index.html`
- Root `README.md` with project overview, tech stack, and roadmap
- `.env.example` with multi-provider AI configuration placeholders
- `.gitignore` for Node.js monorepo

### Changed

- Removed default NestJS Hello World controller and service
- Replaced default Next.js starter page with Phase 1 foundation placeholder
- Moved global styles to `apps/web/src/styles/globals.css`
- Updated NestJS e2e tests to verify application bootstrap (no API endpoints)

### Removed

- Default `app.controller.ts`, `app.service.ts`, and `app.controller.spec.ts`
- Default Next.js marketing content and external links from home page

## [0.0.1] — 2026-07-27

### Added

- Initial project scaffold
- NestJS 11 backend (`apps/api`)
- Next.js 16 frontend (`apps/web`)
- `AI_PROJECT_CONTEXT.md` project rules and context
