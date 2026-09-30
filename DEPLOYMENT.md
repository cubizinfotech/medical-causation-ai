# Deployment — DigitalOcean

Use this file to run the application on the droplet. Local demonstration steps are in [DEMO_GUIDE.md](./DEMO_GUIDE.md).

The droplet already used in this project is `157.230.156.87`. Replace that address if the droplet IP changes.

Run every `npm` command below from the repository root on the server (`~/medical-causation-ai`) after `npm install`.

| Command | What it does |
|---------|----------------|
| `npm run docker:infra` | Starts PostgreSQL, Redis, and pgAdmin in Docker. This is the same as `docker compose up -d postgres redis pgadmin`. |
| `npm run docker:ps` | Shows whether those containers are running |
| `npm run prisma:migrate` | Creates the database tables |
| `npm run dev:api` | Starts the API on port 3001. Leave this terminal open. |
| `npm run dev:web` | Starts the website on port 3000. Leave this terminal open. |
| `npm run reembed:kb:full` | Indexes the knowledge-base files into PostgreSQL. Run this only after the files are copied onto the server. |

`npm run docker:infra` does not start the website. The website and API are the two `dev` commands.

## What runs where

| Service | How you open it | Public? |
|---------|-----------------|---------|
| Web | `http://157.230.156.87:3000` | Yes |
| API | `http://157.230.156.87:3001` | Yes |
| API health | `http://157.230.156.87:3001/health` | Yes |
| pgAdmin | `http://157.230.156.87:5050` | Only if you open port 5050 |
| PostgreSQL | Host `postgres`, port `5432`, inside Docker | No. Do not open 5432 on the internet |
| Redis | Host `redis`, port `6379`, inside Docker | No. Do not open 6379 on the internet |

A 1 vCPU / 2 GB droplet can run Postgres, Redis, pgAdmin, and the Node apps. Building the full API and web Docker images on that size often runs out of memory. Use Docker for the database tools and Node for the website and API.

## 1. Server packages

SSH in, then install Docker if it is not already installed, and install Node.js 20:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
docker compose version
```

Firewall inbound ports for this IP demo: `22`, `3000`, `3001`, and `5050` if you want pgAdmin in the browser. Leave `5432` and `6379` closed.

## 2. Git

```bash
cd ~
git clone <your-repository-url> medical-causation-ai
cd medical-causation-ai
```

Later updates:

```bash
cd ~/medical-causation-ai
git pull
npm install
npm run prisma:migrate
```

Then restart the API and web terminals.

Do not commit `.env`, `.env.live`, or files inside `knowledge-base/books`, `articles`, `reports`, `templates`, or `uploads`. Those folders are gitignored because the documents are large.

## 3. Environment file

On the server, the file must be named `.env` in the repository root.

```bash
cp .env.example .env
nano .env
```

For the current IP demo, set at least:

```env
NODE_ENV=development
FRONTEND_URL=http://157.230.156.87:3000
NEXT_PUBLIC_API_URL=http://157.230.156.87:3001
API_PUBLIC_URL=http://157.230.156.87:3001

POSTGRES_USER=mca_user
POSTGRES_PASSWORD=choose-a-long-password
POSTGRES_DB=medical_causation_ai
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
DATABASE_URL=postgresql://mca_user:choose-a-long-password@127.0.0.1:5432/medical_causation_ai

PGADMIN_DEFAULT_EMAIL=admin@medical-causation.ai
PGADMIN_DEFAULT_PASSWORD=choose-a-pgadmin-password
PGADMIN_PORT=5050

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://127.0.0.1:6379/0

AI_PROVIDER=mistral
EMBEDDING_PROVIDER=openrouter
MISTRAL_API_KEY=paste-from-your-local-env
OPENROUTER_API_KEY=paste-from-your-local-env

KNOWLEDGE_BASE_PATH=./knowledge-base
RESEARCH_PROVIDER=mock
EMAIL_PROVIDER=console
EMAIL_DELIVERY_ENABLED=false
AUTH_ENABLED=false
```

`NODE_ENV=development` matches the demo-guide process (`npm run dev:api` and `npm run dev:web`). Use `production` only when you run the built Docker images.

Paste the AI keys from your laptop `.env`. Medical Causation Analysis needs them. Expert Witness Investigation with `RESEARCH_PROVIDER=mock` does not call paid research sites.

There is a laptop file named `.env.live` you can copy up instead:

```powershell
scp .env.live root@157.230.156.87:~/medical-causation-ai/.env
```

Do not commit that file.

## 4. Database, Redis, and pgAdmin

From `~/medical-causation-ai` on the server:

```bash
npm install
npm run docker:infra
npm run docker:ps
npm run prisma:migrate
```

`npm run docker:infra` starts three containers: `mca-postgres`, `mca-redis`, and `mca-pgadmin`. Wait until `npm run docker:ps` shows postgres as healthy before `npm run prisma:migrate`.

The same Docker start, if you prefer the Compose line:

```bash
docker compose up -d postgres redis pgadmin
docker compose ps
```

### pgAdmin

Open `http://157.230.156.87:5050`.

| Field | Value |
|-------|--------|
| Email | `PGADMIN_DEFAULT_EMAIL` from `.env` |
| Password | `PGADMIN_DEFAULT_PASSWORD` from `.env` |

Register the database server inside pgAdmin:

| Field | Value |
|-------|--------|
| Host | `postgres` |
| Port | `5432` |
| Database | `POSTGRES_DB` (`medical_causation_ai`) |
| Username | `POSTGRES_USER` (`mca_user`) |
| Password | `POSTGRES_PASSWORD` from `.env` |

Use host `postgres`, not `localhost`. pgAdmin runs in Docker, and `postgres` is the database container name.

### Redis

Redis has no password unless `REDIS_PASSWORD` is set. The API reaches it as host `redis` on port `6379` when both run in Docker. When the API runs on the host with `npm run dev:api`, `.env` should use `REDIS_HOST=127.0.0.1` because Compose publishes port 6379 on the droplet.

Check it from the server:

```bash
docker exec mca-redis redis-cli ping
```

A healthy reply is `PONG`.

## 5. Start the website and API

Use two terminals, both in `~/medical-causation-ai`:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

If port 3000 is already taken, stop the other program. The website must stay on 3000 and the API on 3001.

Confirm:

```bash
curl -fsS http://127.0.0.1:3001/health
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000
```

Then open `http://157.230.156.87:3000` in a browser.

`npm run dev:web` reads `NEXT_PUBLIC_API_URL` from `.env`. If you change that URL, restart the web process.

## 6. Upload the knowledge base

Medical books and articles are not in Git. Copy them from your Windows project folder.

PowerShell, from `D:\medical-causation-ai`:

```powershell
scp -r .\knowledge-base\books .\knowledge-base\articles .\knowledge-base\reports .\knowledge-base\templates root@157.230.156.87:~/medical-causation-ai/knowledge-base/
```

Create any missing folder on the server first:

```bash
mkdir -p ~/medical-causation-ai/knowledge-base/{books,articles,reports,templates,uploads}
```

After the copy finishes, index the documents. Postgres must be up, and `OPENROUTER_API_KEY` (or the embedding key for your `EMBEDDING_PROVIDER`) must be set in `.env`.

```bash
cd ~/medical-causation-ai
npm run reembed:kb:full
```

That command reads `KNOWLEDGE_BASE_PATH` (`./knowledge-base`), chunks the documents, and stores embeddings in PostgreSQL. Expert Witness Investigation does not use this folder.

Indexing a large library takes a long time and uses the embedding API. Run it once after upload, and again after you add or replace documents.

## 7. Optional full Docker stack

On a larger droplet (about 4 GB RAM or more):

```bash
docker compose -f docker-compose.yml -f docker-compose.live.yml up -d --build
```

`NEXT_PUBLIC_API_URL` is baked into the web image at build time. Rebuild web after you change it. Skip this path on a 2 GB droplet.

## 8. Leave these off until you decide

- Do not run `npm run seed:demo-users` on a public server. The command refuses to run when `NODE_ENV=production`. Demo password is `password` and is for a laptop only.
- Keep `RESEARCH_PROVIDER=mock` until a research vendor is approved.
- Keep `EMAIL_DELIVERY_ENABLED=false` until a real sender is approved.
- Set `AUTH_ENABLED=true` and a long `JWT_SECRET` before you share the site beyond a private demo.
- Backups are not installed. Do not treat this droplet as backed up.
