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
| `api` | Built from `docker/api/Dockerfile` | 3001 | `./knowledge-base` mounted read-only |
| `web` | Built from `docker/web/Dockerfile` | 3000 | — |
| `mailpit` | `axllent/mailpit` (profile `mail`) | 8025 / 1025 | — |
| `ollama` | `ollama/ollama` (profile `local-ai`) | 11434 | `mca-ollama-data` |

pgAdmin is for local development. Optional profiles are not started by `docker compose up`.

```bash
docker compose --profile mail up -d mailpit
docker compose --profile local-ai up -d ollama
```

## Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | API liveness. Docker uses this. No secrets. |
| `GET /health/ready` | PostgreSQL + Redis readiness. `503` when degraded. |

Container health checks remain on postgres (`pg_isready`), redis (`PING`), api (`/health`), and web (`/`).


## PostgreSQL

- **Version:** PostgreSQL 17
- **Extension:** pgvector (enabled automatically on first start)
- **Additional extensions:** `uuid-ossp`, `pg_trgm`
- **Schemas:** `documents`, `vectors`, `cases`, `ewi`, `platform` (see [database.md](./database.md))
- **Init scripts:** `docker/postgres/init/`

### Production Considerations

The current deployment target is a DigitalOcean droplet running Docker Compose. See [digitalocean.md](./digitalocean.md). Managed PostgreSQL is optional and is not required for the first deployment.

- Enable SSL when the database is not on the private Docker network: set `DATABASE_SSL=true`
- Restrict network access to application containers only
- Use strong passwords stored outside source control

Automated backups are not part of the approved deployment. See [Optional future improvement: backups](./digitalocean.md#optional-future-improvement-backups).

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

| Check | Target |
|-------|--------|
| PostgreSQL | `pg_isready` |
| Redis | `redis-cli ping` |
| API liveness | `GET /health` |
| API readiness | `GET /health/ready` (database + Redis) |
| Web | HTTP fetch to port 3000 |

Responses do not include credentials or connection strings.

## Background Jobs

BullMQ workers use Redis. Queue prefixes and TTLs come from `JOB_*` / `ANALYSIS_JOB_TTL_SECONDS`. MCA and EWI keep separate queues.

## Email

Production mail uses the shared email service. Set `EMAIL_PROVIDER=smtp`, `EMAIL_DELIVERY_ENABLED=true`, a confirmed `EMAIL_FROM` on the client domain, and `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` in the environment. Do not put those values in source control.

`EMAIL_PROVIDER=console` logs messages and does not send them. A transactional vendor is not connected. Details and the local Mailpit option are in [email.md](./email.md).

## Security Checklist (Production)

See [security.md](./security.md).

- [ ] Secrets live in the server environment, not in git
- [ ] HTTPS enforced on the public site
- [ ] CORS restricted to the frontend origin
- [ ] Database and Redis are not exposed to the public internet
- [ ] `AUTH_ENABLED=true` and a unique `JWT_SECRET` before the site is public
- [ ] Demo users are not seeded in production
- [ ] No patient or case content in logs or version control

## Monitoring

`GET /health` and `GET /health/ready` are implemented. Container health checks cover Postgres, Redis, the API, and the web app. DigitalOcean’s droplet graphs show CPU, memory, and disk. Error-tracking products and queue dashboards are not connected.

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

- [x] Health endpoints `GET /health` and `GET /health/ready`
- [ ] CI/CD pipeline
- [ ] Production secrets management

## Related Documentation

- [DigitalOcean](./digitalocean.md)
- [Docker](./docker.md)
- [Database](./database.md)
- [Security](./security.md)
- [Architecture](./architecture.md)
- [Development Guide](./development.md)
