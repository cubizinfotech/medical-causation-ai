# Folder Structure

This document describes the dual-product monorepo layout (**MCA** + **EWI**) with a shared Common/platform layer.

## Root Directory

```
medical-causation-ai/
├── apps/
│   ├── api/                  # NestJS backend (MCA + EWI + Common)
│   └── web/                  # Next.js frontend (MCA + EWI + Common UI)
├── packages/                 # Shared npm packages (future extraction)
├── knowledge-base/           # Private RAG corpora
│   ├── books|articles|...    # MCA default (flat)
│   └── ewi/                  # EWI-only corpus
├── docs/
├── docker/
├── .env.example
├── README.md
├── TODO.md
├── CHANGELOG.md
└── AI_PROJECT_CONTEXT.md
```

## Backend (`apps/api/src`) — Common / MCA / EWI

```
src/
├── platform/                 # COMMON contracts + Nest scaffolds
│   ├── auth|users|email|audit|report|storage|search|jobs|logging/
│   └── platform.module.ts
├── ai/                       # COMMON AI providers, prompts, embeddings
├── config/                   # COMMON env-driven configuration
├── database/                 # COMMON Prisma
├── redis/                    # COMMON Redis / BullMQ connection
├── integrations/             # COMMON external adapters
├── modules/
│   ├── common/               # COMMON facade (KB, docs, indexing, RAG)
│   ├── knowledge-base/       # COMMON implementation
│   ├── document-processing/  # COMMON implementation
│   ├── indexing/             # COMMON implementation
│   ├── rag/                  # COMMON implementation
│   ├── mca/                  # MCA product only
│   │   └── medical-analysis/
│   └── ewi/                  # EWI product only
│       ├── investigation/
│       ├── correspondence/
│       ├── research/
│       └── report/
├── common/                   # Nest guards/filters (future)
├── queues/                   # Shared queue name helpers
└── app.module.ts             # Composition: Platform → AI → Common → MCA → EWI
```

| Directory | Boundary | Purpose |
|-----------|----------|---------|
| `platform/` | Common | Auth, users, email providers, audit, report, storage, search; job prefixes |
| `ai/` | Common | LLM/embedding providers, prompt infrastructure |
| `config/` | Common | Environment configuration |
| `database/` | Common | Prisma client |
| `redis/` | Common | Redis client for cache/queues |
| `modules/common/` | Common | Facade exporting KB / document / indexing / RAG modules |
| `modules/mca/` | MCA | Medical causation analysis |
| `modules/ewi/` | EWI | Expert witness investigation |
| `integrations/` | Common | Replaceable external API adapters |

### Backend Path Aliases

| Alias | Maps To |
|-------|---------|
| `@platform/*` | `src/platform/*` |
| `@ai/*` | `src/ai/*` |
| `@config/*` | `src/config/*` |
| `@database/*` | `src/database/*` |
| `@modules/*` | `src/modules/*` |
| `@integrations/*` | `src/integrations/*` |
| `@redis/*` | `src/redis/*` |

## Frontend (`apps/web/src`)

```
src/
├── app/
│   ├── page.tsx              # Product chooser
│   ├── mca/                  # MCA routes
│   └── ewi/                  # EWI routes
├── components/
│   ├── ui/                   # COMMON design system
│   ├── layout/               # COMMON chrome
│   └── mca/                  # MCA-only UI (demo form, medical report)
├── features/
│   ├── common/               # COMMON API helpers
│   ├── mca/                  # MCA features
│   └── ewi/                  # EWI features
└── lib/config/               # COMMON env helpers
```

Legacy paths (`features/demo`, `features/medical-analysis`, `components/demo`, …) re-export MCA modules for compatibility.

### Frontend routes

| Route | Product |
|-------|---------|
| `/` | Chooser |
| `/login` | Shared login (used when the API reports auth enabled) |
| `/mca/*` | MCA |
| `/ewi/*` | EWI |
| `/case`, `/analysis`, `/report`, `/histories` | Redirect → `/mca/*` |

## Future separation

1. Extract `platform/` + `ai/` + `modules/common` implementations → shared package or platform service.
2. Split `modules/mca` / `modules/ewi` into separate Nest apps.
3. Split `app/mca` / `app/ewi` into separate Next apps sharing `components/ui`.

## Related Documentation

- [Architecture](./architecture.md)
- [EWI Architecture](./ewi-architecture.md)
- [Architecture Decisions](./architecture-decisions-mca-ewi.md)
- [Development Guide](./development.md)
