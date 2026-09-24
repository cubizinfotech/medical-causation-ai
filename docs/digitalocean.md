# DigitalOcean deployment

This is the production deployment guide. Local development does not use this server. Follow [development.md](./development.md) and [docker.md](./docker.md) on your own machine.

The first production shape is one Ubuntu droplet running Docker Compose: web, API, PostgreSQL, and Redis. A managed database, a load balancer, and backup products are not part of this setup.

## Service classes

| Service | Class | Local development | Production |
|---------|-------|-------------------|------------|
| PostgreSQL + pgvector | Required | Docker on your machine | Container on the droplet |
| Redis | Required | Docker on your machine | Container on the droplet |
| API | Required | `npm run dev:api` | Container |
| Web | Required | `npm run dev:web` | Container |
| Reverse proxy and HTTPS | Required in production | Not used | Caddy or Nginx on the droplet |
| pgAdmin | Optional, local only | Port 5050 | Do not run |
| Mailpit | Optional, local only | Profile `mail` | Do not run |
| Ollama | Optional, free local AI | Profile `local-ai` | Optional, not required |
| Chat model (Groq free tier, or a paid provider) | Optional locally | Not required for EWI. Needed only for a live MCA analysis | Required for live MCA analysis. One provider is enough |
| Embedding provider | Optional locally | Needed only when you re-index documents | Required when new documents are indexed |
| Research vendor APIs | Optional, many are paid | Not used. `RESEARCH_PROVIDER=mock` | Not required until a vendor is approved |
| SMTP email | Optional | Console log only | Required only after the client confirms a sender and domain |
| Demo user seed | Local only | `npm run seed:demo-users` | Do not run |

Paid API credentials are not required for local development.

## Server requirements

| | Minimum | Comfortable |
|--|---------|-------------|
| Size | 2 vCPU, 4 GB RAM | 4 vCPU, 8 GB RAM |
| Disk | 40 GB SSD | 80 GB SSD if the knowledge base grows |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| Network | Public IPv4 | A domain name you control |

4 GB is enough to boot the stack. Indexing a large knowledge base needs more memory. Start with the comfortable size if MCA indexing will run on the droplet.

## Ubuntu setup

Create a droplet with Ubuntu 24.04. Add your SSH key. Do not enable a password login for daily use.

```bash
sudo apt update
sudo apt upgrade -y
sudo timedatectl set-timezone UTC
```

Create a deploy user, add it to the `sudo` group, and sign in as that user for the steps below. Allow SSH, HTTP, and HTTPS in the cloud firewall. Do not open ports 5432, 6379, 3000, 3001, or 5050 to the world.

## Docker installation

```bash
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Sign out and back in so the docker group applies. Check:

```bash
docker compose version
```

## Docker Compose setup

Clone the repository on the droplet. Copy `.env.example` to `.env` and set production values. Then:

```bash
docker compose up -d --build
```

Do not start the `mail` or default pgAdmin exposure for a public server. pgAdmin is a local tool. If the compose file publishes database ports, override those publishes so they bind to `127.0.0.1` only, or remove them and use the Docker network.

The API image does not include the Prisma CLI. Install Node.js 20 on the droplet for migrations and any one-off admin command, or run those commands from an admin machine that can reach Postgres on a private address. Do not open Postgres to the internet to make that convenient.

## Environment variables

Set these in the server `.env`. Never commit that file.

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Postgres on the Docker network. No password in git |
| `REDIS_URL` | Redis on the Docker network. Set `REDIS_PASSWORD` |
| `FRONTEND_URL` | `https://your-domain.example` |
| `NEXT_PUBLIC_API_URL` | Public API origin. It is baked in at web image build time |
| `AUTH_ENABLED` | `true` |
| `JWT_SECRET` | Long random string, unique to this server |
| `EMAIL_PROVIDER` | `console` until sending is confirmed |
| `EMAIL_DELIVERY_ENABLED` | `false` until sending is confirmed |
| `RESEARCH_PROVIDER` | `mock` until a vendor is approved |
| `AI_PROVIDER` | One configured provider if MCA analysis must run |

Leave unused provider keys empty. A full list of names is in `.env.example`.

## Database

Postgres runs as the `postgres` service with pgvector. The hostname from other containers is `postgres`. Apply migrations before relying on the API:

```bash
npm run prisma:migrate
```

Details are in [database.md](./database.md).

## Redis

Redis runs as the `redis` service. MCA and EWI keep separate BullMQ prefixes. Set a password in production. Do not publish port 6379 publicly.

## Application containers

| Container | Role |
|-----------|------|
| `api` | NestJS on port 3001 inside the Docker network |
| `web` | Next.js on port 3000 inside the Docker network |

Rebuild the web image when `NEXT_PUBLIC_API_URL` changes:

```bash
docker compose build --build-arg NEXT_PUBLIC_API_URL=https://api.your-domain.example web
docker compose up -d web
```

## Reverse proxy

Install Caddy on the host. It terminates HTTPS and forwards to the containers. Bind the app ports to localhost if they are published, and proxy to those localhost ports.

Example Caddyfile:

```
your-domain.example {
  reverse_proxy 127.0.0.1:3000
}

api.your-domain.example {
  reverse_proxy 127.0.0.1:3001
}
```

Nginx with Certbot is an equivalent choice. Use one proxy, not both.

## Domain configuration

At the DNS host, create A records for the site and the API that point at the droplet’s public IPv4 address. Wait until the names resolve before requesting a certificate.

## SSL/HTTPS

Caddy obtains and renews certificates from Let’s Encrypt when ports 80 and 443 reach the droplet and the DNS records are correct. Confirm `https://your-domain.example` loads and `http://` redirects to `https://`.

Set `FRONTEND_URL` to the https origin.

## Migrations

`npm run prisma:migrate` applies the committed Prisma migrations (`prisma migrate deploy`). Run it after each update that includes a new migration, before or immediately after the new API container starts. Do not edit applied migration files on the server.

## Seed and demo users

Do not seed demo users in production. `npm run seed:demo-users` exits when `NODE_ENV=production`.

Those accounts and the shared local password exist for laptops and demonstrations only. See [authentication.md](./authentication.md). Create real users with their own passwords out of band when auth is enabled.

## Logs

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs --tail 100 postgres redis
```

Logs must not be treated as a place to store case text. They are for startup and error diagnosis.

## Restarting services

```bash
docker compose restart api web
docker compose up -d
```

`restart` keeps the current image. `up -d` recreates containers after a compose or env change.

## Updating deployment

```bash
git pull
npm run prisma:migrate
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3001/health/ready
```

Roll back by checking out the previous git revision, rebuilding, and restoring the database only if a migration cannot move forward. Practice that on a copy first. There is no approved backup job yet.

## Health checks

| Check | Healthy result |
|-------|----------------|
| `GET /health` | API process is up |
| `GET /health/ready` | API, Postgres, and Redis are usable. `503` when not |
| `docker compose ps` | `api`, `web`, `postgres`, and `redis` are running |

Call health on localhost or through the proxy. Neither response includes a password or connection string.

## Basic monitoring

Use `docker compose ps`, the health URLs, and the CPU, memory, and disk graphs on the DigitalOcean droplet page. That is the monitoring in place today.

An external uptime checker, error tracker, or queue dashboard is not connected.

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md). On the droplet, start with `docker compose ps` and `docker compose logs --tail 200 api`.

## Optional future improvement: backups

Backups are not approved and are not installed by this guide. When the client approves them, a reasonable later step is DigitalOcean droplet snapshots or a scheduled Postgres dump copied off the droplet, plus a tested restore. Until that decision, do not describe the deployment as backed up.

## Related

- [deployment.md](./deployment.md)
- [docker.md](./docker.md)
- [security.md](./security.md)
- [database.md](./database.md)
- [email.md](./email.md)
