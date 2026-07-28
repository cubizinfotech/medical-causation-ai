# Deployment Guide

## Overview

This document describes the deployment architecture for **Medical Causation AI**, including the Docker-based local development environment and production deployment targets.

## Docker Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Docker Network              │
                    │           (mca-network)             │
                    │                                     │
  Host :3000  ─────▶│  ┌─────────┐      ┌─────────────┐  │
                    │  │   web   │─────▶│     api     │  │
                    │  │ Next.js │      │   NestJS    │  │
                    │  │  :3000  │      │    :3001    │  │
                    │  └─────────┘      └──────┬──────┘  │
                    │                          │         │
                    │         ┌────────────────┼─────┐   │
                    │         │                │     │   │
                    │  ┌──────▼──────┐  ┌──────▼──┐  │   │
                    │  │  PostgreSQL │  │  Redis  │  │   │
                    │  │  + pgvector │  │   :6379 │  │   │
                    │  │    :5432    │  └─────────┘  │   │
                    │  └──────┬──────┘               │   │
                    │         │                      │   │
                    │  ┌──────▼──────┐               │   │
                    │  │   pgAdmin   │               │   │
                    │  │    :80      │               │   │
                    │  └─────────────┘               │   │
                    └─────────────────────────────────────┘

  Host :5050 ──────▶ pgAdmin
  Host :5432 ──────▶ PostgreSQL (dev access)
  Host :6379 ──────▶ Redis (dev access)
```

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production-ready full stack |
| `docker-compose.dev.yml` | Development overrides (hot reload, volume mounts) |

### Commands

```bash
# Validate configuration
docker compose config

# Start full production stack
docker compose up -d --build

# Start infrastructure only (recommended for local dev)
docker compose up -d postgres redis pgadmin

# Development stack with hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (destructive)
docker compose down -v
```

## Services

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| `postgres` | `pgvector/pgvector:pg17` | 5432 | `mca-postgres-data` |
| `redis` | `redis:7-alpine` | 6379 | `mca-redis-data` |
| `pgadmin` | `dpage/pgadmin4:latest` | 5050 | `mca-pgadmin-data` |
| `api` | Built from `docker/api/Dockerfile` | 3001 | — |
| `web` | Built from `docker/web/Dockerfile` | 3000 | — |

All services use the `mca-network` bridge network for internal communication.

## PostgreSQL

- **Version:** PostgreSQL 17
- **Extension:** pgvector (enabled automatically on first start)
- **Additional extensions:** `uuid-ossp`, `pg_trgm`
- **Schemas:** `app`, `documents`, `vectors` (prepared, no tables yet)
- **Init scripts:** `docker/postgres/init/`

### Production Considerations

- Use managed PostgreSQL (AWS RDS, Supabase, Neon, Azure Database)
- Enable automated backups and point-in-time recovery
- Enable SSL: set `DATABASE_SSL=true`
- Restrict network access to application containers only
- Use strong passwords stored in a secrets manager

## Redis

- **Version:** Redis 7 Alpine
- **Config:** `docker/redis/redis.conf`
- **Persistence:** AOF enabled (`appendonly yes`)
- **Memory limit:** 256 MB with `allkeys-lru` eviction

### Production Considerations

- Use managed Redis (AWS ElastiCache, Redis Cloud, Upstash)
- Enable authentication: set `REDIS_PASSWORD`
- Use TLS in production
- Increase `maxmemory` based on workload

## Environment Variables

All configuration is driven by environment variables. See [.env.example](../.env.example).

**Critical production variables:**

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL connection string with SSL |
| `REDIS_URL` | Redis connection string |
| `AI_PROVIDER` | Active AI provider |
| `LOG_LEVEL` | `warn` or `error` in production |
| `LOG_PRETTY_PRINT` | `false` in production |

Never commit `.env` files or secrets to version control.

## Dockerfiles

| Dockerfile | Purpose |
|------------|---------|
| `docker/api/Dockerfile` | Multi-stage production NestJS build |
| `docker/api/Dockerfile.dev` | Development with hot reload |
| `docker/web/Dockerfile` | Multi-stage production Next.js standalone build |
| `docker/web/Dockerfile.dev` | Development with hot reload |

### Next.js Standalone Output

The web Dockerfile uses Next.js `output: "standalone"` for minimal production images. Build args:

```bash
docker compose build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com web
```

## Frontend Deployment

The Next.js application can be deployed to:

- **Vercel** (recommended for Next.js)
- **AWS Amplify**
- **Docker** (via `docker/web/Dockerfile`)

Set `NEXT_PUBLIC_API_URL` to the production API URL at build time.

## Backend Deployment

The NestJS application can be deployed to:

- **AWS ECS / Fargate**
- **Google Cloud Run**
- **Azure Container Apps**
- **Docker** (via `docker/api/Dockerfile`)

## Health Checks

Docker Compose health checks are configured for all services:

| Service | Check |
|---------|-------|
| PostgreSQL | `pg_isready` |
| Redis | `redis-cli ping` |
| API | HTTP fetch to port 3001 |
| Web | HTTP fetch to port 3000 |

> Dedicated `/health` API endpoints will be added in Phase 2.

## Background Jobs (Future)

BullMQ workers will use Redis for:

- PDF parsing and chunking
- Embedding generation
- Report generation
- Medical literature search

## Security Checklist (Production)

- [ ] All secrets in a secrets manager (AWS Secrets Manager, Vault)
- [ ] HTTPS enforced on all endpoints
- [ ] CORS restricted to frontend origin
- [ ] Database and Redis not exposed to public internet
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all API inputs
- [ ] Audit logging enabled
- [ ] Database backups configured
- [ ] No PHI in logs or version control

## Monitoring (Future)

- Structured JSON logging
- Health check endpoints (`/health`, `/ready`)
- Error tracking (Sentry)
- BullMQ queue monitoring

## Phase 1b Status

Docker infrastructure is **implemented**:

- [x] Docker Compose with all services
- [x] PostgreSQL 17 + pgvector auto-initialization
- [x] Redis with production-ready configuration
- [x] pgAdmin for database administration
- [x] Multi-stage Dockerfiles for API and Web
- [x] Named volumes and internal networking
- [x] Health checks on all services
- [x] Environment-driven configuration

**Not yet implemented:**

- [ ] Prisma schema and migrations
- [ ] Dedicated `/health` API endpoints
- [ ] CI/CD pipeline
- [ ] Production secrets management

## Related Documentation

- [Architecture](./architecture.md)
- [Development Guide](./development.md)
