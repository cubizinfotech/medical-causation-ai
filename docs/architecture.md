# Architecture

## Dual-product layout (MCA + EWI)

The monorepo hosts two products behind shared infrastructure:

| Layer | Location | Role |
|-------|----------|------|
| **Platform (Common contracts)** | `apps/api/src/platform/` | Auth, users, email providers, audit, report, storage, search; job prefixes |
| **Common Nest modules** | `apps/api/src/modules/common/` | Facade over knowledge-base, document-processing, indexing, RAG |
| **AI** | `apps/api/src/ai/` | LLM/embedding providers, prompts |
| **Config / DB / Redis** | `config/`, `database/`, `redis/` | Shared runtime infrastructure |
| **MCA** | `apps/api/src/modules/mca/` + `/mca/*` UI | Medical Causation Analysis |
| **EWI** | `apps/api/src/modules/ewi/` + `/ewi/*` UI | Expert Witness Investigation |
| **Integrations** | `apps/api/src/integrations/` | External adapters (expert research, future literature) |

**Rules**
- MCA must not import EWI; EWI must not import MCA.
- Shared behavior goes in `platform/`, `ai/`, or `modules/common` (document/RAG) — never duplicated per product.
- Root `/` is a product chooser. Legacy MCA routes redirect to `/mca/*`.

Local development does not need a DigitalOcean server. Production deployment is described in [digitalocean.md](./digitalocean.md).

## Documentation map

| Document | Reader |
|----------|--------|
| [client-overview.md](./client-overview.md) | Non-technical overview (also [index.html](./index.html)) |
| [demo-guide.md](./demo-guide.md) | Local demonstration |
| [architecture.md](./architecture.md) | System shape |
| [folder-structure.md](./folder-structure.md) | Directories |
| [development.md](./development.md) | Day-to-day local work |
| [docker.md](./docker.md) | Containers |
| [ai-architecture.md](./ai-architecture.md) | AI providers |
| [ewi-architecture.md](./ewi-architecture.md) | EWI design |
| [ewi-workflow.md](./ewi-workflow.md) | Investigation stages |
| [research-providers.md](./research-providers.md) | Research adapters |
| [email.md](./email.md) | Email |
| [authentication.md](./authentication.md) | Login and roles |
| [database.md](./database.md) | PostgreSQL schemas |
| [deployment.md](./deployment.md) | Containers and release shape |
| [digitalocean.md](./digitalocean.md) | DigitalOcean droplet |
| [security.md](./security.md) | Security practices |
| [troubleshooting.md](./troubleshooting.md) | Common failures |
| [medical-analysis.md](./medical-analysis.md) | MCA analysis engine |
| [ewi-report-workflow.md](./ewi-report-workflow.md) | EWI Word report |
| [ewi-ai-analysis.md](./ewi-ai-analysis.md) | EWI AI analysis rules |

See also [ewi-architecture.md](./ewi-architecture.md), [architecture-decisions-mca-ewi.md](./architecture-decisions-mca-ewi.md), and [folder-structure.md](./folder-structure.md).

## Overview
