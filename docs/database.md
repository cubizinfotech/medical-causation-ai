# Database

PostgreSQL 17 with the pgvector extension stores application data. Prisma in `apps/api/prisma` owns the schema and migrations. Redis is separate and is not the system of record. See [docker.md](./docker.md).

Local development uses the Postgres container from `npm run docker:infra`. A DigitalOcean database is not required while you are developing.

## Schemas

| Schema | Contents |
|--------|----------|
| `documents` | Knowledge-base document records and chunks |
| `vectors` | Embeddings for those chunks |
| `cases` | MCA case history and analysis results |
| `ewi` | Experts, investigations, findings, analysis, and report metadata |
| `platform` | Users, roles, and user-role links |

Init scripts in `docker/postgres/init/` create the extension and schemas the first time the data volume is empty. Tables come from Prisma migrations.

## Migrations

From the repository root, with `DATABASE_URL` pointing at the database you intend to change:

```bash
npm run prisma:migrate
```

That runs `prisma migrate deploy`. It applies committed migrations. It does not create a new migration. Do not paste migration SQL into a client by hand.

Generate the Prisma client after a schema change with:

```bash
npm run prisma:generate
```

Stop the API first if generate cannot replace the query engine file because the process has it open.

## Local connection

Copy `.env.example` to `.env`. The example uses host `localhost` and port `5432` for tools on your machine. Inside Compose, the hostname is `postgres`.

pgAdmin on port 5050 is optional and is for local use. When you add a server in pgAdmin, the host is `postgres`, not `localhost`. Do not run pgAdmin on a production server.

## Production

On a droplet, keep Postgres on the Docker network. Do not publish port 5432 to the public internet. Set `DATABASE_SSL=true` only when the database connection leaves that private network.

Demo data and the demo user seed are not production setup. See [authentication.md](./authentication.md).

Backups are not configured. See [digitalocean.md](./digitalocean.md#optional-future-improvement-backups).

## Related

- [deployment.md](./deployment.md)
- [troubleshooting.md](./troubleshooting.md)
