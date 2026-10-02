# Demonstration guide

Use this file on a laptop. The DigitalOcean server runs the built API and website under PM2. Those steps are in [DEPLOYMENT.md](./DEPLOYMENT.md). Development Docker Compose is for local development only.

Paid research accounts are not required. Expert Witness Investigation uses sample records. A Medical Causation Analysis that cites your books needs an embedding key and the files in `knowledge-base/`.

## Install

Requirements: Node.js 20.9 or later, npm 10 or later, Docker with Compose v2. Production servers use Node.js 22 LTS.

```bash
cd medical-causation-ai
npm install
cp .env.example .env
npm run docker:infra
npm run docker:ps
npm run prisma:migrate
```

`npm run docker:infra` starts PostgreSQL, Redis, and pgAdmin. It is the same as `docker compose up -d postgres redis pgadmin`. It does not start the website.

Start the apps in two terminals and leave them running:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

| What | Address |
|------|---------|
| Website | http://localhost:3000 |
| API | http://localhost:3001 |
| API health | http://localhost:3001/health |
| pgAdmin | http://localhost:5050 |

If the website says port 3000 is in use, stop the other program. The API must stay on port 3001.

## Settings to leave as they are

| Setting | Local value | Why |
|---------|-------------|-----|
| `RESEARCH_PROVIDER` | `mock` | No research vendor is called |
| `EMAIL_PROVIDER` | `console` | Mail is logged, not sent |
| `EMAIL_DELIVERY_ENABLED` | `false` | Same |
| `AUTH_ENABLED` | `false` | Pages stay open for a tour |
| `KNOWLEDGE_BASE_PATH` | `./knowledge-base` | Where MCA reads documents |

## pgAdmin, PostgreSQL, and Redis

Open http://localhost:5050.

Sign in with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from `.env`. The example file uses `admin@medical-causation.ai` and `admin`. Change those before any shared machine.

Add a server in pgAdmin:

| Field | Value |
|-------|--------|
| Host | `postgres` |
| Port | `5432` |
| Database | `medical_causation_ai` |
| Username | `mca_user` |
| Password | `POSTGRES_PASSWORD` in `.env` (example file uses `mca_password`) |

Redis is on `localhost:6379`. The example file sets no Redis password. Check with:

```bash
docker exec mca-redis redis-cli ping
```

## Product tour

1. Open http://localhost:3000. The home page offers Medical Causation Analysis and Expert Witness Investigation.
2. MCA: open `/mca`, start a case or load an example, and watch progress. History is under `/mca/histories`. A live analysis calls the chat provider in `.env`. Leave the key empty if you only want to click through the screens.
3. EWI: open `/ewi`, then **New Investigation**. Enter a name, city, and specialty. Progress is at `/ewi/investigation`. When it finishes, `/ewi/histories/:id` shows the summary, findings, questions, and **Download Word Report**. Cancel mid-run if you want; retry starts a new job with the same intake.

Some EWI sources show as unavailable or restricted. That is the honest sample-data path.

## Index your own medical documents (optional)

Put PDFs in `knowledge-base/books` or `knowledge-base/articles`. Those folders are not in Git. Then:

```bash
npm run reembed:kb:full
```

You need a working embedding key (`OPENROUTER_API_KEY` when `EMBEDDING_PROVIDER=openrouter`). EWI does not read this folder.

## Demo accounts

Turn these on only when you want to show login.

1. Set `AUTH_ENABLED=true`.
2. Set `JWT_SECRET` to a long random string.
3. Restart the API.
4. Run `npm run seed:demo-users`.

| Role | Email |
|------|--------|
| Super Admin | super-admin@example.com |
| Admin | admin@example.com |
| Attorney | attorney@example.com |
| Paralegal | paralegal@example.com |
| Medical Expert | medical-expert@example.com |
| User | normal-user@example.com |

Each local account uses the password `password`. Do not use these accounts on the public droplet. The seed command refuses to run when `NODE_ENV=production`. Sign in at http://localhost:3000/login.

## Related

- [README.md](./README.md)
- [docs/how-it-works.md](./docs/how-it-works.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [TODO.md](./TODO.md)
