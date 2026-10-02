# DigitalOcean production

The droplet runs two PM2 processes and two Docker containers.

| Name | Runtime | Port on the host |
|------|---------|------------------|
| `mca-web` | PM2 | `3000` (public) |
| `mca-api` | PM2 | `3001` (public) |
| `mca-postgres` | Docker, volume `mca-postgres-data` | `127.0.0.1:5432` |
| `mca-redis` | Docker, volume `mca-redis-data` | `127.0.0.1:6379` |
| `mca-pgadmin` | Docker, optional | `127.0.0.1:5050` through an SSH tunnel |

The API and web do not run in Docker here. `docker-compose.live.yml` has been removed. `docker-compose.dev.yml` is for local development only.

The full procedure (Node.js 22, environment, migrations, PM2 reboot, GitHub secrets, health checks, logs, disk cleanup, and rollback) is [DEPLOYMENT.md](../DEPLOYMENT.md). The commands below match that file.

Checkout: `/var/www/medical-causation-ai`.

## First-time server commands

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
pm2 startup
```

Run the `sudo` line that `pm2 startup` prints, once.

```bash
cd /var/www/medical-causation-ai
cp .env.example .env
docker compose up -d postgres redis
npm ci
npm run prisma:generate
npm run build:api
npm run build:web
npm run prisma:migrate
mkdir -p logs
npm run pm2:start
npm run pm2:save
```

Set `NEXT_PUBLIC_API_URL` in `.env` before `npm run build:web`. The current demo value is `http://157.230.156.87:3001`. Postgres and Redis in that file use `127.0.0.1`, not the Docker names `postgres` and `redis`.

## Later deploys

```bash
bash /var/www/medical-causation-ai/scripts/deploy-production.sh
```

A push to `main` runs that script over SSH when `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_SSH_KEY` are set in GitHub Actions. The workflow does not build application images.

## Checks

```bash
pm2 status
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3001/health/ready
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000
docker exec mca-postgres pg_isready -U mca_user -d medical_causation_ai
docker exec mca-redis redis-cli ping
```

## Cleanup that leaves the database in place

```bash
docker rm -f mca-api mca-web
docker image rm medical-causation-ai-api medical-causation-ai-web
docker image prune
docker builder prune
```

Do not run `docker system prune -a --volumes`. Do not remove `mca-postgres`, `mca-redis`, `mca-postgres-data`, or `mca-redis-data`.
