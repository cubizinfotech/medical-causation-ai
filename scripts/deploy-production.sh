#!/usr/bin/env bash
# Deploy the API and web with PM2. Docker stays limited to Postgres and Redis.
# Safe to run more than once. Does not delete database or Redis volumes.
set -euo pipefail

ROOT="${MCA_ROOT:-/var/www/medical-causation-ai}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$ROOT"

if [[ ! -f package.json || ! -f ecosystem.config.js ]]; then
  echo "Expected the repository at $ROOT (package.json and ecosystem.config.js)."
  echo "Clone it there, or set MCA_ROOT to the checkout path."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 22 LTS (minimum 20.9)."
  exit 1
fi

node -e 'const p=process.versions.node.split(".").map(Number); if (p[0]<20 || (p[0]===20 && p[1]<9)) { console.error("Node.js "+process.versions.node+" is too old. Install Node.js 22 LTS."); process.exit(1); } console.log("Node.js "+process.versions.node);'

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 is not installed. On the server run: npm install -g pm2"
  echo "Then once, as the deploy user: pm2 startup"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is not installed."
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Tracked files have local changes. Refusing to deploy."
  git status --short --untracked-files=no
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# Free ports 3000 and 3001 if the old application containers are still present.
# Do not stop mca-postgres or mca-redis.
for name in mca-api mca-web; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    echo "Removing leftover application container $name"
    docker stop "$name"
    docker rm "$name"
  fi
done

docker compose up -d postgres redis

echo "Waiting for PostgreSQL..."
healthy=0
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' mca-postgres 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    healthy=1
    break
  fi
  sleep 2
done
if [[ "$healthy" != "1" ]]; then
  echo "PostgreSQL did not become healthy. Check: docker logs mca-postgres"
  exit 1
fi

mkdir -p logs

npm ci
npm run prisma:generate
npm run build:api
npm run build:web
npm run prisma:migrate

npm run pm2:start
npm run pm2:save
npm run pm2:status

echo "Waiting for the API health endpoint..."
ok=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3001/health" >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" != "1" ]]; then
  echo "API health check failed. See: pm2 logs mca-api --lines 80"
  exit 1
fi

web_code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000 || true)"
echo "Web HTTP status: ${web_code}"
if [[ "$web_code" != "200" && "$web_code" != "304" ]]; then
  echo "Web check failed. See: pm2 logs mca-web --lines 80"
  exit 1
fi

echo "Deploy finished."
