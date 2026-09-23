# EWI product module

Expert Witness Investigation — isolated from MCA.

- `investigation/` — lifecycle, HTTP/WS/jobs/history, and the automatic stage workflow. Start with expert name and specialty. Schema `ewi` stores sources, findings, discrepancies, questions, the report file, and stage events. Restricted providers store metadata and links only.
- `research/` — calls `ExpertResearchService`. Does not call vendor APIs directly.
- `report/` — EWI Word template. Rendering goes through `@platform/report`. See `docs/ewi-report-workflow.md`.

Do not import from `modules/mca`. Use `@platform` contracts and `@integrations/expert-research` adapters.
