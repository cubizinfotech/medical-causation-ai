# EWI product module

Expert Witness Investigation — isolated from MCA.

- `investigation/` — HTTP/WS/jobs/history boundary
- `research/` — expert research orchestration (product-specific)
- `report/` — Word report builder (product-specific)

Do not import from `modules/mca`. Use `@platform` contracts and `@integrations/expert-research` adapters.
