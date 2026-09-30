# Frontend feature boundaries

| Path | Product |
|------|---------|
| `features/common` | Shared API helpers |
| `features/mca` | MCA — medical-analysis, demo intake, report export |
| `features/ewi` | EWI — investigation client, schemas, job hook |
| `features/auth` | Login session |

`features/demo` and `features/medical-analysis` re-export the MCA modules. Pages may import either path.
