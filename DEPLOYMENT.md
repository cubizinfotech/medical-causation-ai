# Medical Causation AI — Deployment Guide

Production deployment reference for the **Medical Causation AI Platform**.

> For local demonstration setup, see [DEMO_GUIDE.md](./DEMO_GUIDE.md).

## Server Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 vCPU | 4+ vCPU |
| RAM | 4 GB | 8+ GB |
| Disk | 20 GB SSD | 50+ GB SSD (grows with knowledge base) |
| OS | Linux (Ubuntu 22.04+) | Linux |

## Runtime Versions

| Technology | Version |
|------------|---------|
| Node.js | 20.x LTS or later |
| npm | 10.x or later |
| PostgreSQL | 17 with **pgvector** extension |
| Redis | 7.x |
| Docker | 24.x+ (optional) |
| Docker Compose | v2 |

## Architecture Overview

```
Internet
    │
    ▼
┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│   NestJS    │
│   (web)     │     │   (api)     │
│   :3000     │     │   :3001     │
└─────────────┘     └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        PostgreSQL      Redis    Knowledge Base
        + pgvector     (cache)    (volume mount)
```

## Environment Variables

Copy `.env.example` to `.env` and configure for production.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_*` | Database credentials (Docker) |
| `AI_PROVIDER` | Active LLM provider (`openrouter`, `openai`, etc.) |
| `AI_CHAT_MODEL` | Chat/completion model (not rerank) |
| `EMBEDDING_PROVIDER` | Embedding provider |
| `OPENROUTER_API_KEY` / provider keys | AI API credentials |
| `KNOWLEDGE_BASE_PATH` | Path to document storage |
| `FRONTEND_URL` | Public frontend URL (CORS) |
| `NEXT_PUBLIC_API_URL` | Public API URL (frontend build) |
| `NODE_ENV` | `production` |

### Recommended Production

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection for future caching/queues |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | `180000` for long analyses |
| `AI_TEMPERATURE` | `0.2` for deterministic legal research |
| `LOG_LEVEL` | `info` or `warn` |

### Security

- **Never** commit `.env` to version control
- Store secrets in a vault (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate API keys regularly
- Use TLS termination at reverse proxy (nginx, Caddy, ALB)

## Docker Deployment

### Build and start

```bash
cp .env.example .env
# Edit .env for production values

docker compose config          # Validate
docker compose up -d --build   # Start full stack
```

### Services

| Service | Port | Image |
|---------|------|-------|
| `web` | 3000 | Built from `docker/web/Dockerfile` |
| `api` | 3001 | Built from `docker/api/Dockerfile` |
| `postgres` | 5432 | `pgvector/pgvector:pg17` |
| `redis` | 6379 | `redis:7-alpine` |
| `pgadmin` | 5050 | `dpage/pgadmin4` (dev/admin only) |

### Volumes

- `mca-postgres-data` — database persistence
- `mca-redis-data` — Redis persistence
- Mount `knowledge-base/` as read-only volume for the API container

### Health checks

```bash
docker compose ps
docker exec mca-postgres pg_isready -U mca_user
docker exec mca-redis redis-cli ping
```

## Manual Deployment

### 1. Database

```bash
# Install PostgreSQL 17 + pgvector
# Run init scripts from docker/postgres/init/

cd apps/api
npm run prisma:migrate
```

### 2. Build applications

```bash
npm install
npm run build
```

### 3. Start API

```bash
cd apps/api
NODE_ENV=production npm run start:prod
```

### 4. Start Web

```bash
cd apps/web
NODE_ENV=production npm run start
```

### Reverse proxy (nginx example)

```nginx
server {
  listen 443 ssl;
  server_name app.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}

server {
  listen 443 ssl;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_read_timeout 180s;
  }
}
```

Set `proxy_read_timeout` to at least **180 seconds** for medical analysis requests.

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build API + web |
| `npm run build:api` | Build NestJS only |
| `npm run build:web` | Build Next.js only |
| `npm run test` | Run API unit tests |
| `npm run lint` | Lint both apps |
| `npm run typecheck` | TypeScript validation |

## Production Recommendations

### Application

- Run API behind a process manager (PM2, systemd) or container orchestrator
- Use Next.js `standalone` output (already configured)
- Enable structured logging (Winston/Pino — planned Phase 2e)
- Add `GET /health` endpoint before production traffic (planned)

### Database

- Enable automated backups for PostgreSQL
- Use connection pooling (PgBouncer) under load
- Monitor pgvector index size and query performance

### AI

- Set rate limits on analysis endpoint
- Monitor token usage and costs per provider
- Use dedicated chat models (not rerank models) for `AI_CHAT_MODEL`

### Security

- Enable HTTPS everywhere
- Restrict CORS to production frontend domain
- Do not expose PostgreSQL or Redis ports publicly
- Remove pgAdmin from production stacks
- Audit logs for PHI — not yet implemented

### Scaling (future)

- Horizontal API scaling behind load balancer
- BullMQ job queue for async analysis
- Redis caching for retrieval results
- CDN for static frontend assets

## CI/CD Checklist

```bash
npm run lint
npm run typecheck
npm run test
npm run build
docker compose config
```

## Related Documentation

- [DEMO_GUIDE.md](./DEMO_GUIDE.md) — local demonstration setup
- [docs/deployment.md](./docs/deployment.md) — detailed Docker architecture
- [docs/architecture.md](./docs/architecture.md) — system design
- [README.md](./README.md) — project overview
