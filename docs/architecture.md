# Architecture

## Dual-product layout (MCA + EWI)

The monorepo hosts two products behind shared infrastructure:

| Layer | Location | Role |
|-------|----------|------|
| **Platform (Common contracts)** | `apps/api/src/platform/` | Auth, users, email, audit, report, storage, search scaffolds; job prefixes |
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

See [ewi-architecture.md](./ewi-architecture.md), [architecture-decisions-mca-ewi.md](./architecture-decisions-mca-ewi.md), and [folder-structure.md](./folder-structure.md).

## Overview
