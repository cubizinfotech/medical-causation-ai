# Frontend feature boundaries

| Path | Product |
|------|---------|
| `features/auth` | Sign-in session, safe redirect after login, profile |
| `features/common` | Shared API response parsing and formatting |
| `features/mca` | MCA: case form and storage, analysis client, records, report export, demand letter |
| `features/ewi` | EWI: investigation client, schemas, job hook |

Pages import from these folders directly (for example `@/features/mca/demo/constants`). MCA and EWI never import each other.
