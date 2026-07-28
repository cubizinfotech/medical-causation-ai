# Development Guide

## Prerequisites

- **Node.js** 20.x or later
- **npm** 10.x or later
- **Git**
- **Docker** 24.x or later
- **Docker Compose** v2

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Machine                     │
│                                                          │
│  ┌──────────────┐         ┌──────────────┐            │
│  │  Next.js     │  HTTP   │   NestJS     │            │
│  │  :3000       │────────▶│   :3001      │            │
│  │  (host/dev)  │         │  (host/dev)  │            │
│  └──────────────┘         └──────┬───────┘            │
│                                    │                     │
│         ┌──────────────────────────┼──────────────┐     │
│         │         Docker Network   │              │     │
│         │  ┌───────────┐  ┌───────▼──┐  ┌──────┐ │     │
│         │  │ PostgreSQL │  │  Redis   │  │pgAdmin│ │     │
│         │  │ +pgvector  │  │          │  │ :5050 │ │     │
│         │  │   :5432    │  │  :6379   │  └──────┘ │     │
│         │  └───────────┘  └──────────┘           │     │
│         └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Repository Setup

```bash
git clone <repository-url>
cd medical-causation-ai

# Configure environment
cp .env.example .env

# Install all workspace dependencies from root
npm install
```

## Environment Configuration

Copy `.env.example` to `.env` at the project root. All services read from this file.

Key sections:

| Section | Purpose |
|---------|---------|
| Application | `NODE_ENV`, `APP_NAME` |
| Frontend | `WEB_PORT`, `NEXT_PUBLIC_API_URL` |
| Backend | `API_PORT`, `PORT` |
| Database | `DATABASE_URL`, `POSTGRES_*` |
| Redis | `REDIS_URL`, `REDIS_*` |
| AI Providers | `AI_PROVIDER`, `OPENAI_*`, `ANTHROPIC_*`, etc. |
| Embeddings | `AI_EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` |
| Feature Flags | `FEATURE_RAG`, `FEATURE_AI_PROCESSING` |

See [.env.example](../.env.example) for the full annotated list.

## Running Locally

### Recommended: Infrastructure in Docker, Apps on Host

```bash
# Start PostgreSQL, Redis, and pgAdmin
npm run docker:infra

# Terminal 1 — Backend
npm run dev:api

# Terminal 2 — Frontend
npm run dev:web
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| pgAdmin | http://localhost:5050 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Full Stack in Docker (Production-like)

```bash
docker compose up -d --build
```

### Full Stack in Docker (Development with Hot Reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Without Docker

Apps can run without Docker, but PostgreSQL and Redis will not be available:

```bash
npm run dev:api   # terminal 1
npm run dev:web   # terminal 2
```

## PostgreSQL

PostgreSQL 17 with pgvector starts automatically via Docker Compose.

**Initialization scripts** (`docker/postgres/init/`):

1. `01-extensions.sql` — enables `vector`, `uuid-ossp`, `pg_trgm`
2. `02-schemas.sql` — creates `app`, `documents`, `vectors` schemas

**Verify pgvector:**

```bash
docker exec -it mca-postgres psql -U mca_user -d medical_causation_ai \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

**Connect via pgAdmin:**

1. Open http://localhost:5050
2. Login with `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` from `.env`
3. Add server: Host `postgres`, Port `5432`, User/Password from `.env`

## Redis

Redis 7 starts with a custom configuration at `docker/redis/redis.conf`.

**Key prefix conventions** (enforced in application code, future phases):

| Prefix | Purpose |
|--------|---------|
| `mca:cache:*` | General application cache |
| `mca:session:*` | User session data |
| `mca:bull:*` | BullMQ queue keys |
| `mca:ai:task:*` | AI processing task state |

**Verify Redis:**

```bash
docker exec -it mca-redis redis-cli ping
# Expected: PONG
```

## Configuration Modules

### Backend (`apps/api/src/config/`)

All environment variables are read exclusively in config modules:

| Module | File | Purpose |
|--------|------|---------|
| `AppConfig` | `app.config.ts` | App name, port, environment |
| `DatabaseConfig` | `database.config.ts` | PostgreSQL connection |
| `RedisConfig` | `redis.config.ts` | Redis connection and TTL |
| `AIConfig` | `ai.config.ts` | AI provider settings |
| `StorageConfig` | `storage.config.ts` | Knowledge base paths |
| `LoggingConfig` | `logging.config.ts` | Log level and format |
| Feature Flags | `feature-flags.config.ts` | Feature toggles |

Access via NestJS `ConfigService` — never use `process.env` elsewhere.

```typescript
import { ConfigService } from '@nestjs/config';
import type { DatabaseSettings } from '@config/config.types';

const db = configService.get<DatabaseSettings>('database');
```

### Frontend (`apps/web/src/lib/config/`)

| Module | File | Purpose |
|--------|------|---------|
| Env helpers | `env.ts` | `getEnv`, `getEnvBoolean`, `getEnvNumber` |
| App metadata | `app.ts` | Name, version, environment |
| API config | `api.ts` | `NEXT_PUBLIC_API_URL`, `apiUrl()` helper |

```typescript
import { apiConfig, apiUrl, appMetadata } from '@/lib/config';
```

## Available Scripts

### Root (`package.json`)

| Command | Description |
|---------|-------------|
| `npm run dev:infra` | Start postgres, redis, pgadmin in Docker |
| `npm run dev:api` | Start NestJS with hot reload |
| `npm run dev:web` | Start Next.js dev server |
| `npm run build` | Build both apps |
| `npm run lint` | Lint both apps |
| `npm run typecheck` | TypeScript check both apps |
| `npm run test` | Run API unit tests |
| `npm run docker:infra` | Start infrastructure containers |
| `npm run docker:up` | Start full Docker stack |
| `npm run docker:down` | Stop all containers |
| `npm run docker:validate` | Validate compose configuration |

### Backend (`apps/api`)

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run format` | Prettier |

### Frontend (`apps/web`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## TypeScript Path Aliases

See [Folder Structure](./folder-structure.md) for the full alias reference.

## Phase 1 Infrastructure Notes

This phase provides Docker, PostgreSQL + pgvector, Redis, and configuration modules only.

**Not yet implemented:**

- API endpoints (including health checks)
- Prisma schema and database tables
- BullMQ queues
- AI provider integration
- Authentication

## Knowledge Base

Medical reference documents are stored in `knowledge-base/`. See [knowledge-base/README.md](../knowledge-base/README.md).

## Related Documentation

- [Architecture](./architecture.md)
- [Deployment Guide](./deployment.md)
- [AI Architecture](./ai-architecture.md)
- [RAG Workflow](./rag-workflow.md)
