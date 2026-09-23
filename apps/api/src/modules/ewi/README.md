# EWI product module

Expert Witness Investigation — isolated from MCA.

- `investigation/` — lifecycle, HTTP/WS/jobs/history. Start with expert name and specialty. Schema `ewi` (experts, investigations, sources, findings, discrepancies, questions, reports, events). Restricted providers (LexisNexis, Westlaw) store metadata and links only.
- `research/` — calls `ExpertResearchService`. Does not call vendor APIs directly.
- `report/` — Word report builder (product-specific)

Do not import from `modules/mca`. Use `@platform` contracts and `@integrations/expert-research` adapters.
