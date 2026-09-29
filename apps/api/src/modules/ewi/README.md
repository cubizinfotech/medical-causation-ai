# EWI product module

Expert Witness Investigation — isolated from MCA.

- `investigation/` — lifecycle, HTTP/WS/jobs/history, and the automatic stage workflow. Start with expert name, city, and specialty. Schema `ewi` stores the identity snapshot, categorized findings, inconsistencies, questions, the report file, and stage events. Restricted providers store metadata and links only. LexisNexis PDFs are not stored.
- `research/` — calls `ExpertResearchService` and compares collected statements in `DiscrepancyAnalyzer`. The catalog in `integrations/expert-research` is the only provider list. Does not call vendor APIs directly. Model output is not used to decide whether a statement is true.
- `report/` — EWI Word template. Rendering goes through `@platform/report`. See `docs/ewi-report-workflow.md`.

Do not import from `modules/mca`. Use `@platform` contracts and `@integrations/expert-research` adapters.
