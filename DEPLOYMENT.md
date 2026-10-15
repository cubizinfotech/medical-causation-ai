# Deployment — DigitalOcean

Production runs the website and API with **PM2** on the host. Docker runs **PostgreSQL** and **Redis** only. Do not start `mca-api` or `mca-web` containers on this server.

Local laptop steps stay in [DEMO_GUIDE.md](./DEMO_GUIDE.md). Development Docker Compose (`docker-compose.dev.yml`) is for local development only.

The droplet already used for this project is `157.230.156.87`. Replace that address if the IP changes. Do not hardcode it in application source. Put the public URL in the server `.env` before the web build.

Preferred checkout path: `/var/www/medical-causation-ai`. The deploy script also accepts `~/medical-causation-ai` if that is the only clone. Set `MCA_ROOT` when the path is different.

## Architecture

| Process | How it runs | Address |
|---------|-------------|---------|
| `mca-web` | PM2, `npm run start:web` | `BIND_HOST:3000` |
| `mca-api` | PM2, `npm run start:api` | `BIND_HOST:3001` |
| `mca-postgres` | Docker, volume `mca-postgres-data` | `127.0.0.1:5432` |
| `mca-redis` | Docker, volume `mca-redis-data` | `127.0.0.1:6379` |
| `mca-pgadmin` | Docker, optional profile `tools` | `127.0.0.1:5050` |
| `mca-caddy` | Docker, profile `https` | port `80` (and `443` with HTTPS) |

`BIND_HOST` in `.env` is `127.0.0.1`: only Caddy reaches ports 3000 and 3001, and visitors use port 80 (`CADDYFILE=Caddyfile.ip`) or HTTPS. `0.0.0.0` is only for running without Caddy. Public firewall ports: `22` and `80`, plus `443` once HTTPS is on. Leave `3000`, `3001`, `5432`, `6379`, and `5050` closed. pgAdmin and the database are reached through an SSH tunnel, not the public internet.

PM2 keeps the API and web running after you log out of SSH. `pm2 startup` plus `pm2 save` starts them again after a reboot. Docker `restart: unless-stopped` does the same for Postgres and Redis.

## 1. Server requirements

- Ubuntu on the droplet
- 50 GB disk. Do not fill it with unused API/web images after this change
- Node.js **22 LTS** (the app requires Node.js `>= 20.9` and npm `>= 10`)
- Docker Engine with Compose v2
- Git
- PM2 installed globally for the deploy user

A 1 vCPU / 2 GB droplet can run Postgres, Redis, and the Node processes. Do not build the API and web Docker images on that size.

## 2. Node.js 22

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

`node -v` should report a 22.x release. The host Node installation is what PM2 uses. The Dockerfiles under `docker/` are not the production runtime.

## 3. Docker

Install Docker Engine and the Compose plugin from Docker’s Ubuntu instructions if `docker compose version` fails. The deploy user must be allowed to run Docker (`sudo usermod -aG docker "$USER"`, then log in again). Do not run the deploy script with sudo.

## 4. Repository

```bash
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
git clone <your-repository-url> /var/www/medical-causation-ai
cd /var/www/medical-causation-ai
```

Do not commit `.env`, `.env.live`, or files inside `knowledge-base/books`, `articles`, `reports`, `templates`, or `uploads`.

## 5. Environment

Start from the production template kept on the laptop, `.env.live` (it already holds the server values, see below), or from `.env.example`:

```bash
cd /var/www/medical-causation-ai
cp .env.example .env
nano .env
```

The file must be named `.env` in the repository root. The API loads it from that path. Next.js loads it from the same file when `npm run build:web` runs (`apps/web/next.config.ts`).

Production values that differ from a laptop:

```env
NODE_ENV=production
FRONTEND_URL=http://157.230.156.87:3000
NEXT_PUBLIC_API_URL=http://157.230.156.87:3001
API_PUBLIC_URL=http://157.230.156.87:3001

BIND_HOST=0.0.0.0

# openssl rand -hex 32 — the API and the deploy script refuse a shorter one
JWT_SECRET=
JWT_EXPIRES_IN=12h
JOB_DAILY_LIMIT_PER_USER=50

POSTGRES_USER=mca_user
POSTGRES_PASSWORD=choose-a-long-password
POSTGRES_DB=medical_causation_ai
POSTGRES_PORT=5432
DATABASE_URL=postgresql://mca_user:choose-a-long-password@127.0.0.1:5432/medical_causation_ai

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# openssl rand -hex 24 — the Redis container and the API both use it
REDIS_PASSWORD=

KNOWLEDGE_BASE_PATH=./knowledge-base
```

`NEXT_PUBLIC_API_URL` is copied into the browser bundle at **build** time. Set it before `npm run build:web`. Changing it later requires that build again, then `pm2 restart mca-web`. A restart alone does not update it.

Use `127.0.0.1` for Postgres and Redis. The names `postgres` and `redis` work only inside containers on the Compose network (`docker-compose.dev.yml`). The API builds the Redis address from `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` (or `REDIS_URL` when set).

Setting `REDIS_PASSWORD` for the first time: the next `docker compose up -d redis` (the deploy script runs it) recreates the Redis container with the password. Queued jobs survive because the data volume is kept; the deploy then restarts the API with the same password.

`KNOWLEDGE_BASE_PATH=./knowledge-base` is the repository folder. PM2’s API working directory is `apps/api`, and the API resolves that relative path against the repository root. Do not set `/knowledge-base` unless you are running the local development containers.

Paste AI keys into the server `.env` only. Do not commit them and do not put them in GitHub.

EWI live research is optional. With `RESEARCH_PROVIDER=live`, the API calls four free public sources over HTTPS: `npiregistry.cms.hhs.gov`, `openpaymentsdata.cms.gov`, `api.openalex.org`, and `www.courtlistener.com`. Only the opposing expert's name, city, specialty, and NPI are sent; no case or patient data. A free `COURTLISTENER_API_TOKEN` is optional and lets the API read opinion text for Daubert/Frye rulings. See [docs/ewi-workflow.md](docs/ewi-workflow.md).

```env
RESEARCH_PROVIDER=live
COURTLISTENER_API_TOKEN=
```

The laptop file `.env.live` is the ready-made production `.env` (same values, grouped and explained). Copy it up as `.env`:

```powershell
scp .env.live deploy@157.230.156.87:/var/www/medical-causation-ai/.env
```

## 6. PostgreSQL

From the repository root:

```bash
docker compose up -d postgres redis
docker ps
docker inspect --format '{{.State.Health.Status}}' mca-postgres
```

Wait until the status is `healthy`. The data directory is the named volume `mca-postgres-data`. Do not delete that volume.

The image is `pgvector/pgvector:pg17`. The first boot runs `docker/postgres/init/01-extensions.sql` (`vector`, `uuid-ossp`, `pg_trgm`) and `02-schemas.sql`. Those scripts run only when the data directory is empty. An existing volume is left as it is.

Open a shell in the database:

```bash
docker exec -it mca-postgres psql -U mca_user -d medical_causation_ai
```

Inside `psql`:

```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

The published port is `127.0.0.1:5432`. It is not reachable from the public internet.

## 7. Redis

Redis is `mca-redis` (`redis:7-alpine`) with append-only persistence on the volume `mca-redis-data`. The API uses it for BullMQ (medical analysis and expert-witness jobs) and for cached job state. Keep a single `mca-api` process so those workers are not duplicated.

The eviction policy must be `noeviction` ([docker/redis/redis.conf](./docker/redis/redis.conf)). With an LRU policy, Redis can delete queued jobs when memory is full. The deploy script applies the setting to the running container; to check it:

```bash
docker exec mca-redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping'
docker exec mca-redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET maxmemory-policy'   # noeviction
```

A healthy reply is `PONG`.

The container listens on all of its own interfaces so Docker can forward the port. Compose publishes that port on `127.0.0.1:6379` only, and the container requires `REDIS_PASSWORD` when it is set. Do not publish `6379` on `0.0.0.0`.

## 8. pgAdmin (optional)

pgAdmin is not required. It is behind the Compose profile `tools` and is bound to localhost.

```bash
docker compose up -d pgadmin
```

From your laptop, open an SSH tunnel and keep that window open (Ctrl+C closes it):

```bash
ssh -N -L 5051:127.0.0.1:5050 deploy@157.230.156.87
```

Then open `http://localhost:5051`. The laptop side uses 5051 because a local pgAdmin (`npm run dev:infra`) already uses 5050; any free port works. If pgAdmin asks you to sign in, use `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from the server `.env`.

Register the server inside pgAdmin with host `postgres` (the container name), port `5432`, and the `POSTGRES_*` values from `.env`. pgAdmin runs on the Compose network, so it uses `postgres`, not `127.0.0.1`.

For a desktop database tool (DBeaver, TablePlus) instead, tunnel PostgreSQL itself and connect to `localhost:5433` with the `POSTGRES_*` values (5433, because a local PostgreSQL may use 5432):

```bash
ssh -N -L 5433:127.0.0.1:5432 deploy@157.230.156.87
```

Many tools can open the tunnel themselves: SSH host `157.230.156.87`, user `deploy`; database host `127.0.0.1`, port `5432`.

Do not open port 5050 or 5432 in the firewall.

## 9. PM2

```bash
sudo npm install -g pm2
pm2 startup
```

`pm2 startup` prints one `sudo` command. Run that command. It installs a systemd unit for your user so PM2 comes back after a reboot. You only do this once.

The process file is `ecosystem.config.js`:

| App | Working directory | Command |
|-----|-------------------|---------|
| `mca-api` | `apps/api` | `node dist/src/main.js` (`npm run start:api`) |
| `mca-web` | `apps/web` | `next start --hostname <BIND_HOST> --port 3000` |

Both use `NODE_ENV=production`, listen on `BIND_HOST` from `.env`, restart after a crash, and write logs under `logs/`. `instances` is `1`: the API process also runs the job workers, and its rate-limit counters live in memory.

## 10. Build and migrate

Run these from `/var/www/medical-causation-ai` after `.env` is in place and Postgres is healthy.

```bash
npm ci
npm run prisma:generate
npm run build:api
npm run build:web
npm run prisma:migrate
```

| Script | What it runs |
|--------|----------------|
| `npm run prisma:generate` | `prisma generate` (client for the build; does not change data) |
| `npm run build:api` | `nest build` in `apps/api` |
| `npm run build:web` | `next build` in `apps/web` |

Do not set `NEXT_STANDALONE=1` on the server. That flag is only for the optional Docker web image. PM2 serves the normal `next start` build.
| `npm run prisma:migrate` | `prisma migrate deploy` |

`prisma migrate deploy` applies pending migrations only. It does not drop the database. Do not use `prisma migrate dev` or `npm run docker:clean` on this server. `docker:clean` runs `docker compose down -v`, which deletes volumes.

`npm ci` reinstalls `node_modules` from the lockfile. That is the deploy install. Do not delete `node_modules` by hand while the site is up.

## 11. Start PM2

```bash
mkdir -p logs
npm run pm2:start
npm run pm2:save
npm run pm2:status
```

Those scripts are:

```bash
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
pm2 status
```

`startOrReload` starts the apps the first time and reloads them on later deploys. `pm2 save` stores the process list. After `pm2 startup`, a reboot runs that saved list.

You can close SSH. The processes keep running. Confirm from a new session with `pm2 status`.

## 12. One-command deploy

On the server:

```bash
bash scripts/deploy-production.sh
```

The script stops on errors. It pulls `main` (fast-forward only), refuses to run if tracked files are dirty, starts Postgres and Redis, removes leftover `mca-api` and `mca-web` containers if they still exist, refuses a `JWT_SECRET` shorter than 32 characters, installs, builds, migrates, reloads PM2, and checks health. It does not delete `mca-postgres`, `mca-redis`, or their volumes.

## 13. GitHub automatic deployment

Workflow: `.github/workflows/deploy-production.yml`.

Every push and pull request first runs the checks: lint, type check, API and website tests, and the build. Only a push to `main` that passes them SSHes into the droplet and runs `scripts/deploy-production.sh`. It does not build Docker images for the API or web.

Repository secrets:

| Secret | Value |
|--------|--------|
| `DEPLOY_HOST` | Droplet IP or hostname |
| `DEPLOY_USER` | SSH user that owns the checkout and PM2 |
| `DEPLOY_SSH_KEY` | Private key, including line breaks |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 <DEPLOY_HOST>` (compare the fingerprint with the one shown on the server). The deploy connects only to that exact host key. |

The production `.env` stays on the server. Do not put it in GitHub.

The workflow pulls `main` on the server first and then runs the deploy script from that commit. The script loads Node.js through nvm when nvm is installed (non-interactive SSH sessions do not read `~/.bashrc`), using the version in `.nvmrc` (22). Without that, the system Node.js (18 on Ubuntu 24.04) runs and the deploy stops with "Node.js … is too old".

The server checkout must already exist, and that user must be able to `git fetch` and run Docker and PM2.

## 14. Health checks

```bash
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3001/health/ready
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000
```

`/health` is liveness (the same path the old API container used). `/health/ready` checks Postgres and Redis and returns 503 when either is down. The web command should print `200`.

From a browser: `http://157.230.156.87:3000`. The site calls `NEXT_PUBLIC_API_URL`.

## 15. Logs

```bash
pm2 status
pm2 logs
pm2 logs mca-api
pm2 logs mca-web
```

Log files:

- `logs/mca-api-out.log` and `logs/mca-api-error.log`
- `logs/mca-web-out.log` and `logs/mca-web-error.log`

`pm2 flush` clears PM2’s logs. Use it only when you mean to discard them.

Rotate logs once on the server:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## 16. Knowledge base

Medical books and articles are not in Git. They stay in the local `knowledge-base/` folder. From the repository root on Windows, upload books and articles that are missing or a different size on the server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\upload-knowledge-base.ps1
```

The script finds `knowledge-base` from its own location. Set `MCA_SSH_TARGET` when the server is not `deploy@157.230.156.87`. Run it again if the connection drops. Files that already match are skipped. See [knowledge-base/README.md](./knowledge-base/README.md).

A one-time copy of every folder, including reports and templates:

```powershell
scp -o ServerAliveInterval=15 -o ServerAliveCountMax=20 -o TCPKeepAlive=yes -r .\knowledge-base\books .\knowledge-base\articles .\knowledge-base\reports .\knowledge-base\templates deploy@157.230.156.87:/var/www/medical-causation-ai/knowledge-base/
```

On the server, before the copy:

```bash
mkdir -p /var/www/medical-causation-ai/knowledge-base/{books,articles,reports,templates,uploads}
df -h
```

`df -h` must show free space larger than the folder you are copying. After the copy finishes, index the files. It can take a long time for many books, so run it in the background, where closing SSH does not stop it:

```bash
cd /var/www/medical-causation-ai
nohup npm run index:kb > logs/index-kb.log 2>&1 &
tail -f logs/index-kb.log      # Ctrl+C stops watching, not the indexing
```

`index:kb` finds the files under `KNOWLEDGE_BASE_PATH`, splits them into passages, embeds them with the configured `EMBEDDING_PROVIDER`, and stores them in PostgreSQL. Files already indexed are skipped, so it is safe to run again after adding books. A file that cannot be indexed (for example a book over `KNOWLEDGE_BASE_MAX_FILE_SIZE_MB`) is reported and skipped; the rest continue. Do not start it while an upload is incomplete.

Scanned PDFs (pages that are images, with no text layer) are read with OCR on the server while indexing. This takes about 1–2 seconds per page on a laptop and longer on the 1-CPU droplet, so a large scanned book can take an hour or more; run it with `nohup` as above. A scan with more than `OCR_MAX_PAGES` (default 500) scanned pages is skipped with a message: split it into parts of up to 500 pages and under the size limit, then index again. A scan OCR cannot read is listed as `failed` with the reason "No readable text".

To index part of the library first, give one or more `--only` texts that appear in the file paths:

```bash
npm run index:kb -- --only "stroke articles" --only "mild tbi"
```

`npm run reembed:kb` is different: it only embeds passages that are already in the database. After changing `EMBEDDING_PROVIDER` or `AI_EMBEDDING_MODEL`, run it once: it replaces the vectors made by the old model a batch at a time, and analyses keep working while it runs. Until it has run, the API log warns `Library vectors were made with … but queries use …`, and analyses search the library by keyword only. (`reembed:kb:full` deletes every vector first, so the library cannot be searched by meaning until it finishes; it is rarely needed. Changing `EMBEDDING_DIMENSIONS` also needs a database migration.)

To check the library, run this in pgAdmin (both numbers above 0 means analyses can search it, and the second query should list only the embedding model in `.env`):

```sql
SELECT (SELECT count(*) FROM documents.document_chunks) AS chunks,
       (SELECT count(*) FROM vectors.chunk_embeddings) AS embeddings;
SELECT provider, model, count(*) FROM vectors.chunk_embeddings GROUP BY 1, 2;
```

To check that searches find relevant passages, run a sample search. It prints passage titles and similarity scores, never passage text:

```bash
npm run check:retrieval
npm run check:retrieval -- "Does whiplash cause cervical disc herniation?"
```

Passages marked `*` count as relevant. When fewer than `RAG_MIN_RELEVANT_CHUNKS` (default 3) are relevant, an analysis does not fail: it adds PubMed abstracts (when `FEATURE_LITERATURE_SEARCH=true`) and the AI's general medical knowledge, and the report labels which statements come from which source.

### Uploaded medical records

Records that attorneys upload on the MCA case form are stored in `CASE_RECORDS_PATH` (default `/var/www/medical-causation-ai/data/case-records`), with their page text in PostgreSQL. The folder is ignored by Git, so deploys never touch it. These are patient records:

- Back up the folder together with the database. A database backup without the files, or the files without the database, cannot be restored on its own. `scripts/backup.sh` does both; see [22. Backups](#22-backups).
- Serve the site over HTTPS before real records are uploaded; the IP demo sends them unencrypted. See [21. Port 80 without a domain, then HTTPS with a domain](#21-port-80-without-a-domain-then-https-with-a-domain).
- The chronology sends record text to the configured `AI_PROVIDER`. Use a provider the firm has approved for patient data.

Expert CVs uploaded on the EWI intake form follow the same rules in `EWI_DOCUMENTS_PATH` (default `data/ewi-documents`): owner-only, deleted with the investigation, and included in `scripts/backup.sh`.

## 17. Disk and Docker cleanup

Inspect before deleting anything:

```bash
df -h
docker system df
docker ps -a
docker images
du -sh ~/.npm
du -sh /var/www/medical-causation-ai/node_modules
du -sh /var/www/medical-causation-ai/logs
```

After PM2 is serving traffic, the old application containers and images are unused. Confirm the names first.

Safe to remove once `pm2 status` shows `mca-api` and `mca-web` online:

```bash
docker rm -f mca-api mca-web
docker image rm medical-causation-ai-api medical-causation-ai-web
docker image prune
docker builder prune
```

`docker image prune` removes dangling images. `docker builder prune` removes build cache. Neither removes named volumes.

`docker container prune` removes stopped containers. Do not run it while a container you still need is stopped. `mca-postgres` and `mca-redis` should be running, so a prune of stopped containers leaves them.

Do **not** run `docker system prune -a --volumes` on this server. That can delete unused volumes, including database data if a container is not using the volume at that moment.

Do **not** delete these:

- containers `mca-postgres` and `mca-redis`
- volumes `mca-postgres-data` and `mca-redis-data`
- `knowledge-base/`

npm cache, only when `npm ci` is failing because the cache is corrupt:

```bash
npm cache verify
npm cache clean --force
```

Prefer `npm cache verify` first. Do not delete `node_modules` as routine cleanup. The next deploy runs `npm ci`.

## 18. Rollback

Roll the application code back. Leave the database volume in place.

```bash
cd /var/www/medical-causation-ai
git log --oneline -20
git checkout <known-good-commit>
npm ci
npm run prisma:generate
npm run build:api
npm run build:web
pm2 restart ecosystem.config.js --update-env
pm2 save
curl -fsS http://127.0.0.1:3001/health
```

`prisma migrate deploy` does not reverse migrations. If the bad deploy already applied a migration, the old code must still work with that schema, or you restore a database backup made before the deploy (see [22. Backups](#22-backups)). Do not drop `medical_causation_ai` to “undo” a deploy.

Return to `main` when you are ready to deploy forward again: `git checkout main`.

## 19. Port troubleshooting

`EADDRINUSE` means something is already listening. Identify it before you stop it.

```bash
sudo lsof -i :3000
sudo lsof -i :3001
ss -ltnp | grep :3000
ss -ltnp | grep :3001
pm2 status
docker ps -a --filter name=mca-
```

An old PM2 app:

```bash
pm2 status
pm2 describe mca-api
pm2 delete mca-api
pm2 delete mca-web
```

Then start once from the repository root:

```bash
npm run pm2:start
npm run pm2:save
```

An old application container holding the port:

```bash
docker stop mca-api mca-web
docker rm mca-api mca-web
```

Do not stop `mca-postgres` or `mca-redis` to free ports 3000 or 3001.

## 20. What stays local

On a laptop, keep using:

```bash
npm run docker:infra
npm run dev:api
npm run dev:web
```

`docker-compose.dev.yml` can still run the API and web in containers for local development. Do not use that file on the droplet.

Leave these off on the public server until you decide otherwise:

- Demo accounts: `npm run seed:demo-users` refuses `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true` and a non-empty `DEMO_USER_PASSWORD` are set. Create real people instead:

  ```bash
  npm run user:create -- jane@firm.example attorney "Jane Doe"
  ```

  It prints a random password once (or uses `NEW_USER_PASSWORD`). An existing email is never changed.
- `RESEARCH_PROVIDER=mock` until you choose to use the live public sources (NPI Registry, Open Payments, OpenAlex, CourtListener); paid research vendors are still not connected
- `EMAIL_DELIVERY_ENABLED=false` until a real sender is approved

Login is always required; there is no switch to turn it off.

## 21. Port 80 without a domain, then HTTPS with a domain

### Port 80 on the IP (no domain yet)

Serves the whole site on port 80, so a firewall only needs ports 22, 80, and 443 open. Caddy answers on port 80 and passes the website (`/`) to port 3000 and the API (`/api`, prefix removed) to port 3001, including the WebSocket progress updates. The configuration is [docker/caddy/Caddyfile.ip](./docker/caddy/Caddyfile.ip). This is still plain HTTP: use a domain with HTTPS (below) before uploading real patient records.

1. In `.env` (`.env.live` already has these):

   ```env
   NEXT_PUBLIC_API_URL=http://157.230.156.87/api
   FRONTEND_URL=http://157.230.156.87
   API_PUBLIC_URL=http://157.230.156.87/api
   BIND_HOST=127.0.0.1
   CADDYFILE=Caddyfile.ip
   ```

2. Run `bash scripts/deploy-production.sh`. It rebuilds the website for the new API address, restarts PM2 with the apps listening only on 127.0.0.1, starts Caddy, and checks `http://127.0.0.1/api/health`.
3. Open `http://157.230.156.87` (no port). Ports 3000 and 3001 are no longer reachable from outside; remove any firewall rules for them.

### HTTPS with a domain

Required before real medical records are uploaded. Over the IP address, everything, including uploaded records and sign-in tokens, travels unencrypted.

Caddy runs in Docker in front of the two PM2 apps, gets Let's Encrypt certificates, renews them, and redirects HTTP to HTTPS. The configuration is [docker/caddy/Caddyfile](./docker/caddy/Caddyfile).

1. Point two DNS names at the server (A records to `157.230.156.87`), for example `app.example.com` for the website and `api.example.com` for the API. Wait until `ping app.example.com` shows the server IP.
2. Allow web traffic. With ufw (`sudo ufw status`):

   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

   With a DigitalOcean cloud firewall, add the same rules there.
3. In `.env` (remove `CADDYFILE` or leave it empty):

   ```env
   APP_DOMAIN=app.example.com
   API_DOMAIN=api.example.com
   ACME_EMAIL=you@example.com
   FRONTEND_URL=https://app.example.com
   NEXT_PUBLIC_API_URL=https://api.example.com
   API_PUBLIC_URL=https://api.example.com
   BIND_HOST=127.0.0.1
   ```

4. Start Caddy, rebuild the website (`NEXT_PUBLIC_API_URL` is built into the browser bundle), and restart (`--update-env` picks up `BIND_HOST`):

   ```bash
   cd /var/www/medical-causation-ai
   docker compose --profile https up -d caddy
   docker logs -f mca-caddy        # wait for "certificate obtained successfully", then Ctrl+C
   npm run build:web
   pm2 restart ecosystem.config.js --update-env
   ```

5. Open `https://app.example.com`, sign in, and start an investigation. Live progress uses a WebSocket, which Caddy passes through.
6. Close the plain-HTTP ports as well (with `BIND_HOST=127.0.0.1` they are already unreachable from outside; this is a second lock):

   ```bash
   sudo ufw deny 3000/tcp
   sudo ufw deny 3001/tcp
   ```

   The deploy script checks health on `127.0.0.1`, so it keeps working.

Caddy adds HSTS, `X-Frame-Options: DENY`, `nosniff`, and a referrer policy to every response. The API adds its own strict headers (helmet), and the website sends a frame-blocking Content-Security-Policy.

Keep the `mca-caddy-data` volume. It holds the certificates; deleting it forces new ones and can hit Let's Encrypt rate limits. `docker compose up -d postgres redis` in the deploy script does not touch Caddy.

## 22. Backups

`scripts/backup.sh` saves the database and the files that belong to it: uploaded medical records (`CASE_RECORDS_PATH`), uploaded expert CVs (`EWI_DOCUMENTS_PATH`), `knowledge-base/uploads`, and generated EWI reports. Each run creates `/var/backups/medical-causation-ai/<UTC time>/` with `database.dump`, `files.tar.gz` (both ending in `.gpg` when encrypted), and `SHA256SUMS`. The dump is checked before it is kept; a failed run keeps nothing. Backups older than 14 days are removed (`BACKUP_KEEP_DAYS`). Books and articles are not included unless `BACKUP_WITH_LIBRARY=1`; their originals are on the laptop.

**Encryption (do this first).** Backups hold patient records. Choose one:

- A GPG public key (best: the private key never sits on the server). Import it with `gpg --import public-key.asc`, then set `BACKUP_GPG_RECIPIENT=<key id or email>`.
- A passphrase file: `openssl rand -base64 32 > ~/.mca-backup-passphrase && chmod 600 ~/.mca-backup-passphrase`, then set `BACKUP_PASSPHRASE_FILE=$HOME/.mca-backup-passphrase`. Keep a copy of the passphrase somewhere else, or the backups cannot be opened.

Install gpg once: `sudo apt install -y gnupg`. Without either setting, backups stay unencrypted, on this server only, and are never copied off it.

Once, as the deploy user:

```bash
sudo mkdir -p /var/backups/medical-causation-ai
sudo chown "$USER":"$USER" /var/backups/medical-causation-ai
cd /var/www/medical-causation-ai
bash scripts/backup.sh
```

Every night at 02:30 (`crontab -e`):

```cron
30 2 * * * cd /var/www/medical-causation-ai && BACKUP_PASSPHRASE_FILE=/home/deploy/.mca-backup-passphrase bash scripts/backup.sh >> logs/backup.log 2>&1
```

A backup on the same server is lost with the server. Also keep an off-server copy: turn on DigitalOcean droplet backups, or install `rclone` and add `BACKUP_RCLONE_REMOTE=<remote>:<folder>` in front of the cron command. The script copies only encrypted backups.

**Decrypt first** when the backup is encrypted; the commands below expect plain files:

```bash
B=/var/backups/medical-causation-ai/<UTC time>
(cd "$B" && sha256sum -c SHA256SUMS)
for f in "$B"/*.gpg; do gpg --batch --pinentry-mode loopback --passphrase-file ~/.mca-backup-passphrase --output "${f%.gpg}" --decrypt "$f"; done
```

With a GPG key, run `gpg --decrypt` on the machine that holds the private key (without the passphrase options). Delete the decrypted copies when you are done.

**Check a backup without touching live data** (restores into a scratch database, then deletes it):

```bash
cd /var/www/medical-causation-ai
B=/var/backups/medical-causation-ai/<UTC time>
U=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
(cd "$B" && sha256sum -c SHA256SUMS)
docker exec mca-postgres createdb -U "$U" restore_check
docker exec -i mca-postgres pg_restore -U "$U" -d restore_check --no-owner < "$B/database.dump"
docker exec mca-postgres dropdb -U "$U" restore_check
```

**Restore** (replaces the current database and files):

```bash
cd /var/www/medical-causation-ai
B=/var/backups/medical-causation-ai/<UTC time>
U=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
D=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)
pm2 stop mca-api mca-web
docker exec -i mca-postgres pg_restore -U "$U" -d "$D" --clean --if-exists --no-owner < "$B/database.dump"
tar -xzf "$B/files.tar.gz" -C /var/www/medical-causation-ai
pm2 start ecosystem.config.js
```
