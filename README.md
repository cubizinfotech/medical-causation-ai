# Medical Causation AI

This application helps personal injury attorneys do two kinds of legal research.

**Medical Causation Analysis (MCA)** studies whether a trauma or accident medically contributed to an injury or disease. The attorney enters the case and can upload the client's medical records (PDF, scanned pages are read with OCR). The app builds a page-cited medical chronology, a bills summary, and a list of "bad facts" the defense may raise, searches the firm's indexed medical library and PubMed, and writes an on-screen report with citations. A draft demand letter can be downloaded in Word. It does not diagnose patients and it is not a hospital record system.

**Expert Witness Investigation (EWI)** researches an opposing expert from a name, city, and medical specialty (optionally an NPI number and their CV), then produces a PDF report, laid out like the MCA report, with cross-examination questions. By default it uses sample research records. With `RESEARCH_PROVIDER=live`, it searches free public sources (NPI Registry, CMS Open Payments, OpenAlex, CourtListener) and confirms the expert's identity before attributing anything. Paid research sites are not connected.

Both products share one website, one API, PostgreSQL, and Redis. Their screens and data stay separate, and every case belongs to the user who created it.

## Where to read next

| File | Use it for |
|------|------------|
| [DEMO_GUIDE.md](./DEMO_GUIDE.md) | Run the demo on your computer |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production on the droplet: PM2 for the website and API, Docker for PostgreSQL and Redis |
| [docs/digitalocean.md](./docs/digitalocean.md) | Short command list for that server |
| [docs/how-it-works.md](./docs/how-it-works.md) | Purpose and the two user flows |
| [docs/mca-workflow.md](./docs/mca-workflow.md) | MCA step by step: button click, queue, search, AI, report |
| [docs/ewi-workflow.md](./docs/ewi-workflow.md) | EWI step by step: button click, stages, PDF report download |
| [docs/index.html](./docs/index.html) | The same overview in a browser |
| [.env.example](./.env.example) | Every setting, grouped and explained |
| [TODO.md](./TODO.md) | What is done and what is still pending |
| [CHANGELOG.md](./CHANGELOG.md) | What changed and when |

## Run it locally

Requirements: Node.js 22 LTS (20.9 minimum), npm 10+, Docker.

```bash
cp .env.example .env          # then set JWT_SECRET (openssl rand -hex 32)
npm install
npm run docker:infra          # PostgreSQL, Redis, pgAdmin
npm run prisma:migrate        # create the tables
npm run seed:demo-users       # 2 default sign-ins, password "password"
```

Then, in two terminals:

```bash
npm run dev:api
npm run dev:web
```

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 (sign in as `gopalhingu123@gmail.com` / `password`) |
| API | http://localhost:3001 (health: `/health`) |
| pgAdmin | http://localhost:5050 |

Inside pgAdmin, the database host is `postgres`, user `POSTGRES_USER`, password `POSTGRES_PASSWORD`. The API on the host uses `127.0.0.1` for Postgres and Redis.

Production on the droplet does not use `npm run dev:api` or the API/web containers. See [DEPLOYMENT.md](./DEPLOYMENT.md).

Medical books and articles live in `knowledge-base/` on your computer and are not in Git. To copy them to the server, run `scripts/upload-knowledge-base.ps1`. The steps are in [knowledge-base/README.md](./knowledge-base/README.md).

## Project map

```text
apps/
  api/                         NestJS API (port 3001)
    prisma/                    database schema and migrations
    scripts/                   indexing, demo seed, create-user
    src/
      main.ts                  startup: security headers, CORS, validation
      config/                  every setting read from .env
      platform/                shared by both products
        auth/                  login, tokens, roles, logout (every route needs login)
        audit/                 audit trail of views, downloads, deletes, sign-ins
        rate-limit/            request limits (login, jobs, uploads)
        jobs/                  queue prefixes, worker settings, daily job limit
        http/                  download headers, WebSocket CORS
        storage/               local file storage for uploads
        users/ email/ report/ health/
      ai/                      AI providers (chat + embeddings) and prompts
      modules/
        mca/                   Medical Causation Analysis
        ewi/                   Expert Witness Investigation
        knowledge-base/ document-processing/ indexing/ rag/   library search
      integrations/            PubMed, NPI Registry, Open Payments, OpenAlex, CourtListener
      redis/                   Redis client (atomic job-record updates)
  web/                         Next.js website (port 3000)
    src/app/                   pages: /mca/*, /ewi/*, /login, /profile
    src/components/            UI; mca/, ewi/, layout/, ui/
    src/features/              API clients, form schemas, session (auth/)
    src/lib/config/            API address and the one fetch helper (apiFetch)
docker/                        Postgres init, Redis config, Caddy (HTTPS), Dockerfiles
scripts/                       deploy-production.sh, backup.sh, upload-knowledge-base.ps1
knowledge-base/                medical library (files not in Git)
data/                          uploaded records and CVs (patient data, not in Git)
```

MCA and EWI never import each other; both use `platform/` and the shared library-search modules.

## Everyday commands

| Command | What it does |
|---------|--------------|
| `npm run validate` | Lint, type check, tests, and build (the same checks CI runs) |
| `npm test` | API unit tests (`npm test --workspace=web` for the website) |
| `npm run prisma:migrate` | Apply new database migrations |
| `npm run index:kb` | Index new or changed files in `knowledge-base/` for the library search |
| `npm run reembed:kb` | Re-embed the indexed library after changing the embedding provider or model (replaces old vectors in place) |
| `npm run check:retrieval` | Run sample library searches and show how well the library covers them |
| `npm run seed:demo-users` | The 2 default sign-ins (gopalhingu123, dcs) |
| `npm run user:create -- <email> <role> "<Name>"` | Create a real account |

## Security in short

- Every API route except `/health` and `/auth/login` requires a signed-in user; each case, record, CV, and report is visible only to its owner.
- Sign-ins last 12 hours and end on the server when the user signs out. `JWT_SECRET` must be 32+ characters.
- Login, job starts, and uploads are rate-limited, and each user can start at most `JOB_DAILY_LIMIT_PER_USER` paid AI jobs per day.
- Views, downloads, and deletes of case data are written to `platform.audit_events`.
- Production must run behind HTTPS (Caddy). Until a domain is set up, the IP site is plain HTTP; see [DEPLOYMENT.md](./DEPLOYMENT.md).
- Backups contain patient data; `scripts/backup.sh` encrypts them when a GPG key or passphrase is configured and only copies encrypted backups off the server.
