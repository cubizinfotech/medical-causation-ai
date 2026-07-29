# Medical Causation AI

Enterprise SaaS platform that helps personal injury attorneys determine whether trauma or accidents medically contributed to a patient's injury or disease using scientific evidence, epidemiology, AI reasoning, and peer-reviewed medical literature.

> **This is not a hospital system, EMR, or medical diagnosis tool.** It is a legal research and causation analysis platform for attorneys.

## Project Overview

Attorneys handling personal injury cases often need to answer causation questions such as:

- Did a car accident contribute to a patient's stroke?
- Did trauma worsen a spinal injury?
- Did a workplace accident increase the risk of a disease?

**Medical Causation AI** automates the research and analysis process by searching medical databases, retrieving scientific evidence, applying accepted causation principles, and generating attorney-ready reports with citations.

## Prerequisites

- **Node.js** 20.x or later
- **npm** 10.x or later
- **Git**
- **Docker** 24.x or later (for PostgreSQL, Redis, and containerized services)
- **Docker Compose** v2

## Folder Structure

```
medical-causation-ai/
├── apps/
│   ├── api/              # NestJS backend
│   └── web/              # Next.js frontend
├── docker/
│   ├── api/              # NestJS Dockerfile (prod + dev)
│   ├── web/              # Next.js Dockerfile (prod + dev)
│   ├── postgres/init/    # PostgreSQL initialization scripts (pgvector)
│   └── redis/            # Redis configuration
├── packages/             # Shared packages (future)
├── knowledge-base/       # Private documents for RAG
│   ├── books/
│   ├── articles/
│   ├── reports/
│   ├── templates/
│   └── uploads/
├── docs/                 # Project documentation
├── docker-compose.yml    # Production Docker Compose stack
├── docker-compose.dev.yml # Development overrides
└── scripts/              # Utility scripts (future)
```

| Directory | Purpose |
|-----------|---------|
| `apps/api` | NestJS API — configuration, modules, AI, medical logic |
| `apps/web` | Next.js frontend — UI, features, services |
| `docker/postgres` | PostgreSQL init scripts — pgvector extension, schemas |
| `docker/redis` | Redis config — caching, queues, session cache |
| `knowledge-base` | Private medical documents for future RAG indexing |
| `docs` | Architecture, development, and deployment documentation |

See [docs/folder-structure.md](./docs/folder-structure.md) for the complete directory reference.

## Technology Stack

### Frontend
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Shadcn-style UI components
- TanStack Query
- React Hook Form + Zod

### Backend
- NestJS 11
- TypeScript
- PostgreSQL 17 + pgvector
- Redis 7

### AI
- Provider-agnostic AI architecture (`AiService` single entry point)
- LLM providers: OpenRouter (default), OpenAI, Anthropic, Gemini, Groq
- Embedding providers: OpenAI, Gemini, Voyage, Jina, Nomic, Ollama (future)
- File-based prompt template management

## Screenshots

> Placeholder — add screenshots to `docs/images/` for demonstrations:
>
> | Screenshot | Path |
> |------------|------|
> | Landing page | `docs/images/demo-landing.png` |
> | Case intake form | `docs/images/demo-case-form.png` |
> | AI processing screen | `docs/images/demo-analysis.png` |

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `AI_PROVIDER` | LLM provider (`openrouter`, `openai`, `anthropic`, `gemini`, `groq`) |
| `AI_CHAT_MODEL` | Chat model — **must be a chat model, not rerank** |
| `EMBEDDING_PROVIDER` | Embedding provider for RAG |
| `OPENROUTER_API_KEY` | OpenRouter API key (default provider) |
| `KNOWLEDGE_BASE_PATH` | Path to `knowledge-base/` directory |
| `FRONTEND_URL` | CORS origin for API (`http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | API URL for frontend (`http://localhost:3001`) |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Analysis timeout (`180000` recommended) |

See [DEMO_GUIDE.md](./DEMO_GUIDE.md) for full configuration walkthrough.

## Docker Setup

### Quick Start — Infrastructure Only

Start PostgreSQL (with pgvector), Redis, and pgAdmin:

```bash
cp .env.example .env
npm run docker:infra
```

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | `localhost:5432` | See `.env` (`POSTGRES_*`) |
| Redis | `localhost:6379` | No password (local dev) |
| pgAdmin | [http://localhost:5050](http://localhost:5050) | See `.env` (`PGADMIN_*`) |

### Full Stack (Production-like)

```bash
docker compose up -d --build
```

### Development Stack (Hot Reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Docker Commands

```bash
npm run docker:up        # Start all services
npm run docker:down      # Stop all services
npm run docker:infra     # Start postgres, redis, pgadmin only
npm run docker:build     # Build all images
npm run docker:logs      # Tail service logs
npm run docker:ps        # List running containers
npm run docker:validate  # Validate compose configuration
npm run docker:clean     # Stop and remove volumes
```

## Running Locally

### Option A — Infrastructure in Docker, Apps on Host (Recommended)

```bash
# 1. Configure environment
cp .env.example .env

# 2. Start infrastructure
npm run docker:infra

# 3. Install dependencies (from project root)
npm install

# 4. Start backend (terminal 1)
npm run dev:api

# 5. Start frontend (terminal 2)
npm run dev:web
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:3001](http://localhost:3001)
- pgAdmin: [http://localhost:5050](http://localhost:5050)

### Option B — Without Docker

Run apps directly without PostgreSQL or Redis (configuration modules still load defaults):

```bash
cp .env.example .env
npm install
npm run dev:api   # terminal 1
npm run dev:web   # terminal 2
```

> PostgreSQL and Redis are required for full functionality in later phases.

## PostgreSQL

- **Image:** `pgvector/pgvector:pg17` (PostgreSQL 17 with pgvector)
- **Extensions enabled on init:** `vector`, `uuid-ossp`, `pg_trgm`
- **Schemas prepared:** `app`, `documents`, `vectors` (no tables yet)
- **Init scripts:** `docker/postgres/init/`

Verify pgvector after starting:

```bash
docker exec -it mca-postgres psql -U mca_user -d medical_causation_ai -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

## Redis

- **Image:** `redis:7-alpine`
- **Config:** `docker/redis/redis.conf`
- **Prepared for:** caching (`cache:*`), BullMQ queues (`bull:*`), AI tasks (`ai:task:*`), sessions (`session:*`)

Verify Redis after starting:

```bash
docker exec -it mca-redis redis-cli ping
```

## Root Commands

```bash
npm run dev:infra     # Start Docker infrastructure
npm run dev:api       # Start NestJS with hot reload
npm run dev:web       # Start Next.js dev server
npm run build         # Build both apps
npm run lint          # Lint both apps
npm run typecheck     # TypeScript check both apps
npm run test          # Run API unit tests
npm run format        # Format API source files
```

### Medical Analysis (manual test)

Requires Docker PostgreSQL with indexed knowledge base and a valid `AI_CHAT_MODEL` (chat model, not rerank):

```bash
cd apps/api
# Set a chat model — e.g. openai/gpt-4o-mini via OpenRouter
npx ts-node -r tsconfig-paths/register scripts/run-medical-analysis.ts \
  "Can mild traumatic brain injury increase the risk of stroke?"
```

See [docs/medical-analysis.md](./docs/medical-analysis.md) for workflow, schema, and safety rules.

### Demonstration UI

```bash
# Terminal 1 — API (requires Docker + indexed knowledge base)
npm run dev:api

# Terminal 2 — Frontend
npm run dev:web
```

- Landing: [http://localhost:3000](http://localhost:3000)
- Case form: [http://localhost:3000/case](http://localhost:3000/case)
- Analysis: [http://localhost:3000/analysis](http://localhost:3000/analysis)
- Histories: [http://localhost:3000/histories](http://localhost:3000/histories)
- Report: [http://localhost:3000/report](http://localhost:3000/report)

See [DEMO_GUIDE.md](./DEMO_GUIDE.md) for the full client demonstration script (step-by-step).

## Backend Commands

```bash
cd apps/api
npm run start:dev    # Development with hot reload
npm run build        # Compile TypeScript
npm run start:prod   # Run production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Unit tests
npm run test:e2e     # End-to-end tests
```

## Frontend Commands

```bash
cd apps/web
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/architecture.md) | System design and principles |
| [Folder Structure](./docs/folder-structure.md) | Directory layout reference |
| [Development](./docs/development.md) | Local setup and workflows |
| [Deployment](./docs/deployment.md) | Production deployment guide |
| [AI Architecture](./docs/ai-architecture.md) | AI provider and workflow design |
| [Knowledge Base](./docs/knowledge-base.md) | Document management and discovery |
| [Document Processing](./docs/document-processing.md) | PDF/DOCX/TXT parsing pipeline |
| [Indexing](./docs/indexing.md) | Chunking, embeddings, pgvector storage |
| [RAG Workflow](./docs/rag-workflow.md) | Hybrid retrieval, context builder, citations |
| [Medical Analysis](./docs/medical-analysis.md) | AI medical causation analysis engine |
| [Frontend Demo](./docs/frontend-demo.md) | Demonstration UI workflow |
| [Demo Guide](./DEMO_GUIDE.md) | Step-by-step demonstration setup |
| [Deployment](./DEPLOYMENT.md) | Production deployment reference |
| [Client Overview](./docs/index.html) | Client-friendly HTML documentation |

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1a** | Project foundation, folder structure, documentation | ✅ Complete |
| **Phase 1b** | Docker, PostgreSQL + pgvector, Redis, configuration | ✅ Complete |
| **Phase 1c** | AI architecture — providers, AiService, prompts, embeddings | ✅ Complete |
| **Phase 1d** | Knowledge base — document discovery, metadata, validation | ✅ Complete |
| **Phase 2a** | Document processing — PDF/DOCX/TXT parsing, normalization | ✅ Complete |
| **Phase 2b** | Knowledge indexing — chunking, embeddings, pgvector storage | ✅ Complete |
| **Phase 2c** | RAG retrieval — hybrid search, context builder, citations | ✅ Complete |
| **Phase 2d** | Medical analysis — RAG + LLM structured causation reasoning | ✅ Complete |
| **Phase 2e** | Prisma schema, health checks, Swagger, KB/AI API endpoints | Planned |
| **Phase 3** | Demonstration UI — landing, case form, analysis workflow | ✅ Complete |
| **Phase 4** | Case history, report viewer, PDF export | ✅ Complete |
| **Phase 5** | Authentication, multi-tenant law firm management | Planned |
| **Phase 6** | Medical literature search (PubMed, PMC, Semantic Scholar) | Planned |
| **Phase 7** | Enhanced PDF report templates | Planned |
| **Phase 8** | Admin panel, audit logs, notifications | Planned |
| **Phase 9** | Subscription and billing | Planned |

## License

Proprietary — All rights reserved.
