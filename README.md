# Medical Causation AI

This application helps personal injury attorneys do two kinds of legal research.

**Medical Causation Analysis (MCA)** studies whether a trauma or accident medically contributed to an injury or disease. It searches the firm’s indexed medical documents and writes an on-screen report with citations. It does not diagnose patients and it is not a hospital record system.

**Expert Witness Investigation (EWI)** researches an opposing expert from a name, city, and medical specialty, then downloads a Microsoft Word report with cross-examination questions. The local and server demo uses sample research records. Live paid research sites are not connected.

Both products share one website, one API, PostgreSQL, and Redis. Their screens and data stay separate.

## Where to read next

| File | Use it for |
|------|------------|
| [DEMO_GUIDE.md](./DEMO_GUIDE.md) | Run the demo on your computer |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production on the droplet: PM2 for the website and API, Docker for PostgreSQL and Redis |
| [docs/digitalocean.md](./docs/digitalocean.md) | Short command list for that server |
| [docs/how-it-works.md](./docs/how-it-works.md) | Purpose and the two user flows |
| [docs/index.html](./docs/index.html) | The same overview in a browser |
| [TODO.md](./TODO.md) | What is done and what is still pending |

## Run it locally

Requirements: Node.js 20.9 or newer (production server: Node.js 22 LTS), npm 10+, Docker.

```bash
cp .env.example .env
npm install
npm run docker:infra
npm run prisma:migrate
```

`npm run docker:infra` starts PostgreSQL, Redis, and pgAdmin. It is the same as `docker compose up -d postgres redis pgadmin`.

Then, in two terminals:

```bash
npm run dev:api
npm run dev:web
```

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 |
| API | http://localhost:3001 |
| pgAdmin | http://localhost:5050 |

pgAdmin email and password are `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` in `.env`. Inside pgAdmin, the database host is `postgres`, user `POSTGRES_USER`, password `POSTGRES_PASSWORD`. The API on the host uses `127.0.0.1` for Postgres and Redis. Redis has no password unless `REDIS_PASSWORD` is set.

Production on the droplet does not use `npm run dev:api` or the API/web containers. See [DEPLOYMENT.md](./DEPLOYMENT.md).

Step-by-step clicks are in [DEMO_GUIDE.md](./DEMO_GUIDE.md).

Medical books and articles live in `knowledge-base/` on your computer and are not in Git. To copy them to the server, run `scripts/upload-knowledge-base.ps1`. The steps are in [knowledge-base/README.md](./knowledge-base/README.md).
