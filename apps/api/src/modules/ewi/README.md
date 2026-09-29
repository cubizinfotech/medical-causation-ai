# EWI product module

Expert Witness Investigation — isolated from MCA.

- `investigation/` — lifecycle, HTTP/WS/jobs/history, and the automatic stage workflow. Start with expert name, city, and specialty. Schema `ewi` stores the identity snapshot, categorized findings, inconsistencies, questions, the report file, request/email records, and stage events. Restricted providers store metadata and links only. LexisNexis PDFs are not stored.
- `documents/` — EWI evidence intake on shared document-processing (PDF/DOCX/TXT/MD/images, OCR, Bates/page refs, duplicates, Lexis storage rejection). See `docs/document-processing.md`.
- `research/` — calls `ExpertResearchService` and compares collected statements in `DiscrepancyAnalyzer`. Legal, online-presence, and professional dossiers are built from collected findings via analyzer helpers (`buildLegalResearchDossier`, `buildOnlinePresenceDossier`, `buildProfessionalBackgroundDossier`). The catalog in `integrations/expert-research` is the only provider list. Does not call vendor APIs directly. Model output is not used to decide whether a statement is true.
- `investigation/analysis/` — final AI analysis layer via shared `AiService` + prompt templates (`ewi/investigation-analysis*`). Deterministic structure first; validated model wording only. See `docs/ewi-ai-analysis.md`.
- `correspondence/` — FOIA / university / follow-up / TrialSmith request templates and gated prepare/approve/send workflow. Delivery uses `@platform/email`. Local default logs and does not transmit. See `docs/ewi-request-email-workflow.md`.
- `report/` — EWI Word template `ewi/investigation-report` (v2) on shared `@platform/report` Docx renderer (TOC, metadata, disclaimer). See `docs/ewi-report-workflow.md`.

Do not import from `modules/mca`. Use `@platform` contracts and `@integrations/expert-research` adapters.

## Local integration status

With `RESEARCH_PROVIDER=mock`, the full investigation path is connected: HTTP intake → BullMQ (`ewi-investigation`) → stage workflow → findings/events in schema `ewi` → analysis → Word report → download. Cancel and retry are supported. Live HTTP adapters are not connected. Request/email workflow is API-only and off by default.
