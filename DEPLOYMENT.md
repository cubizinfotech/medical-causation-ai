# Deployment — DigitalOcean

Production runs the website and API with **PM2** on the host. Docker runs **PostgreSQL** and **Redis** only. Do not start `mca-api` or `mca-web` containers on this server.

Local laptop steps stay in [DEMO_GUIDE.md](./DEMO_GUIDE.md). Development Docker Compose (`docker-compose.dev.yml`) is for local development only.

The droplet already used for this project is `157.230.156.87`. Replace that address if the IP changes. Do not hardcode it in application source. Put the public URL in the server `.env` before the web build.

Preferred checkout path: `/var/www/medical-causation-ai`. The deploy script also accepts `~/medical-causation-ai` if that is the only clone. Set `MCA_ROOT` when the path is different.

## Architecture

| Process | How it runs | Address |
|---------|-------------|---------|
| `mca-web` | PM2, `npm run start:web` | `0.0.0.0:3000` |
| `mca-api` | PM2, `npm run start:api` | `0.0.0.0:3001` |
| `mca-postgres` | Docker, volume `mca-postgres-data` | `127.0.0.1:5432` |
| `mca-redis` | Docker, volume `mca-redis-data` | `127.0.0.1:6379` |
| `mca-pgadmin` | Docker, optional profile `tools` | `127.0.0.1:5050` |

Public firewall ports for the current IP demo: `22`, `3000`, `3001`. Leave `5432`, `6379`, and `5050` closed. pgAdmin is reached through an SSH tunnel, not the public internet.

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

POSTGRES_USER=mca_user
POSTGRES_PASSWORD=choose-a-long-password
POSTGRES_DB=medical_causation_ai
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
DATABASE_URL=postgresql://mca_user:choose-a-long-password@127.0.0.1:5432/medical_causation_ai

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://127.0.0.1:6379/0

KNOWLEDGE_BASE_PATH=./knowledge-base
```

`NEXT_PUBLIC_API_URL` is copied into the browser bundle at **build** time. Set it before `npm run build:web`. Changing it later requires that build again, then `pm2 restart mca-web`. A restart alone does not update it.

Use `127.0.0.1` for Postgres and Redis. The names `postgres` and `redis` work only inside containers on the Compose network (`docker-compose.dev.yml`). BullMQ reads `REDIS_HOST` and `REDIS_PORT`. The Redis client reads `REDIS_URL`. Keep those on `127.0.0.1`.

`KNOWLEDGE_BASE_PATH=./knowledge-base` is the repository folder. PM2’s API working directory is `apps/api`, and the API resolves that relative path against the repository root. Do not set `/knowledge-base` unless you are running the local development containers.

Paste AI keys into the server `.env` only. Do not commit them and do not put them in GitHub.

A laptop file named `.env.live` can be copied up instead. Rename it to `.env` on the server and change `DATABASE_URL`, `REDIS_URL`, and `REDIS_HOST` to `127.0.0.1` if they still use a Docker hostname. Set `NODE_ENV=production`.

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

```bash
docker exec mca-redis redis-cli ping
```

A healthy reply is `PONG`.

The container listens on all of its own interfaces so Docker can forward the port. Compose publishes that port on `127.0.0.1:6379` only. Do not publish `6379` on `0.0.0.0`.

## 8. pgAdmin (optional)

pgAdmin is not required. It is behind the Compose profile `tools` and is bound to localhost.

```bash
docker compose up -d pgadmin
```

From your laptop:

```bash
ssh -L 5050:127.0.0.1:5050 deploy@157.230.156.87
```

Then open `http://127.0.0.1:5050`. Sign in with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD`.

Register the server inside pgAdmin with host `postgres` (the container name), port `5432`, and the `POSTGRES_*` values from `.env`. pgAdmin runs on the Compose network, so it uses `postgres`, not `127.0.0.1`.

Do not open port 5050 in the firewall.

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
| `mca-web` | `apps/web` | `next start --hostname 0.0.0.0 --port 3000` (`npm run start:web`) |

Both use `NODE_ENV=production`, restart after a crash, and write logs under `logs/`. `instances` is `1`.

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

The script stops on errors. It pulls `main` (fast-forward only), refuses to run if tracked files are dirty, starts Postgres and Redis, removes leftover `mca-api` and `mca-web` containers if they still exist, installs, builds, migrates, reloads PM2, and checks health. It does not delete `mca-postgres`, `mca-redis`, or their volumes.

## 13. GitHub automatic deployment

Workflow: `.github/workflows/deploy-production.yml`.

A push to `main` SSHes into the droplet and runs `scripts/deploy-production.sh`. It does not build Docker images for the API or web.

Repository secrets:

| Secret | Value |
|--------|--------|
| `DEPLOY_HOST` | Droplet IP or hostname |
| `DEPLOY_USER` | SSH user that owns the checkout and PM2 |
| `DEPLOY_SSH_KEY` | Private key, including line breaks |

The production `.env` stays on the server. Do not put it in GitHub.

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

`df -h` must show free space larger than the folder you are copying. After the copy finishes:

```bash
cd /var/www/medical-causation-ai
npm run reembed:kb:full
```

That reads `KNOWLEDGE_BASE_PATH` and stores embeddings in PostgreSQL. Do not start it while an upload is incomplete.

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

`prisma migrate deploy` does not reverse migrations. If the bad deploy already applied a migration, the old code must still work with that schema, or you restore a database backup. This server does not have backups installed. Do not drop `medical_causation_ai` to “undo” a deploy.

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

- `npm run seed:demo-users` refuses to run when `NODE_ENV=production`
- `RESEARCH_PROVIDER=mock` until a research vendor is approved
- `EMAIL_DELIVERY_ENABLED=false` until a real sender is approved
- `AUTH_ENABLED=true` and a long `JWT_SECRET` before the site is shared beyond a private demo
