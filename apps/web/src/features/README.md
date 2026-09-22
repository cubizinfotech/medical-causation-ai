# Frontend feature boundaries

| Path | Product |
|------|---------|
| `features/common` | Shared API helpers |
| `features/mca` | MCA — medical-analysis, demo intake, report export |
| `features/ewi` | EWI — investigation client, schemas, job hook |
| `features/knowledge-base`, `rag`, `indexing`, `document-processing` | Shared stubs (future admin) |

Legacy paths `features/demo`, `features/medical-analysis`, `features/report` re-export MCA modules for compatibility.
