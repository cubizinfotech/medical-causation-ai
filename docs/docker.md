# Docker

Local development and the production-like stack both use Docker Compose. You do not need a DigitalOcean droplet to run this on your machine.

Paid API credentials are not required. Leave research and email on their local defaults. See [demo-guide.md](./demo-guide.md).

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Full stack: Postgres, Redis, pgAdmin, API, web, plus optional profiles |
| `docker-compose.dev.yml` | Development overrides (hot reload, volume mounts) |
| `docker/api/Dockerfile` | Production API image |
| `docker/api/Dockerfile.dev` | API image with hot reload |
| `docker/web/Dockerfile` | Production web image |
| `docker/web/Dockerfile.dev` | Web image with hot reload |
| `docker/postgres/init/` | Enables pgvector and creates schemas on first start |
| `docker/redis/redis.conf` | Redis persistence and memory limit |

## Commands

From the repository root:

```bash
npm run docker:infra      # Postgres, Redis, pgAdmin
npm run docker:up         # Full stack
npm run docker:dev        # Full stack with the dev override file
npm run docker:down       # Stop containers
npm run docker:logs       # Follow logs
npm run docker:ps         # List containers
npm run docker:build      # Build images
npm run docker:validate   # Check the compose file
```

`docker:clean` removes containers and volumes. That deletes the local database.

Optional profiles are not started by `docker compose up`:

```bash
docker compose --profile mail up -d mailpit
docker compose --profile local-ai up -d ollama
```

## Services

| Service | Local class | Production class | Notes |
|---------|-------------|------------------|-------|
| PostgreSQL 17 + pgvector | Required | Required | Private medical and investigation data |
| Redis 7 | Required | Required | Background jobs |
| API (NestJS) | Required | Required | Port 3001 |
| Web (Next.js) | Required | Required | Port 3000 |
| pgAdmin | Optional | Do not deploy | Local database UI on port 5050 |
| Mailpit | Optional | Do not deploy | Local email inbox. See [email.md](./email.md) |
| Ollama | Optional | Optional | Free local models. Not required |

AI chat, embeddings, and research vendors are application configuration, not Compose services. Their classes are listed in [digitalocean.md](./digitalocean.md#service-classes).

## Recommended local layout

Run Postgres, Redis, and pgAdmin in Docker. Run the API and web app on the host with `npm run dev:api` and `npm run dev:web`. That is the setup in [development.md](./development.md).

## Health

| Check | Target |
|-------|--------|
| Postgres | `pg_isready` inside the container |
| Redis | `PING` |
| API | `GET /health` and `GET /health/ready` |
| Web | HTTP on port 3000 |

`GET /health/ready` returns 503 when Postgres or Redis is down. Responses do not include passwords.

## Related

- [deployment.md](./deployment.md)
- [digitalocean.md](./digitalocean.md)
- [database.md](./database.md)
- [troubleshooting.md](./troubleshooting.md)
