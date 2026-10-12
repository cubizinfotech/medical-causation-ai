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
npm run seed:demo-users
```

Before the first start, open `.env` and set `JWT_SECRET` to at least 32 random characters (`openssl rand -hex 32`). The API refuses to start without it.

`npm run docker:infra` starts PostgreSQL, Redis, and pgAdmin. It is the same as `docker compose up -d postgres redis pgadmin`. It does not start the website.

`npm run seed:demo-users` creates the two default sign-ins (see [Demo accounts](#demo-accounts)). Every page except the home page, login, terms, and privacy needs a signed-in user.

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

If you set `REDIS_PASSWORD`, add `-a "$REDIS_PASSWORD"` to that command.

## Product tour

1. Open http://localhost:3000 and sign in as `gopalhingu123@gmail.com` with the password `password`. The home page offers Medical Causation Analysis and Expert Witness Investigation.
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

`npm run seed:demo-users` creates these two accounts. Running it again never changes an account that already exists.

| Role | Email |
|------|--------|
| Attorney | gopalhingu123@gmail.com |
| Attorney | dcs@dorothyclaysims.com |

Locally both use the password `password` (or `DEMO_USER_PASSWORD` when set). On the server the seed refuses `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true` and a `DEMO_USER_PASSWORD` of 12+ characters are set. For anyone else, use:

```bash
npm run user:create -- jane@firm.example attorney "Jane Doe"
```

It prints a random password once (or uses `NEW_USER_PASSWORD`). Roles: `super_admin`, `admin`, `attorney`, `paralegal`, `medical_expert`, `user`.

Sign-ins last 12 hours (`JWT_EXPIRES_IN`). **Sign out** ends the session on the server too. After 10 wrong passwords in a minute, login pauses for that minute.

## Related

- [README.md](./README.md)
- [docs/how-it-works.md](./docs/how-it-works.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [TODO.md](./TODO.md)
