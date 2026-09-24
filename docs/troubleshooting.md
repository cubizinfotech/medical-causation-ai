# Troubleshooting

Local development does not need the production server. Start with Postgres and Redis on your machine.

## Application will not start

| What you see | What to do |
|--------------|------------|
| API cannot connect to Postgres | Run `npm run docker:infra`. Confirm `DATABASE_URL` matches `.env.example` for local Docker. |
| API cannot connect to Redis | The same infra command starts Redis. `docker exec -it mca-redis redis-cli ping` should print `PONG`. |
| `JWT_SECRET is required` | Auth is on and the secret is empty. Set a local secret or set `AUTH_ENABLED=false` for an open local demo. |
| Port 3000 or 3001 already in use | Stop the other process, or change `WEB_PORT` / `API_PORT`. |
| Prisma generate fails with a file lock | Stop the API, then run `npm run prisma:generate`. |

## Demo and login

| What you see | What to do |
|--------------|------------|
| MCA or EWI opens without login | Expected when `AUTH_ENABLED` is not `true`. |
| Login says authentication is not configured | Set `JWT_SECRET` and restart the API. |
| Demo user is rejected | Run `npm run seed:demo-users`. See [authentication.md](./authentication.md). |
| Seed refuses to run | `NODE_ENV` is `production`. Use the seed only on a local machine. |

## MCA analysis

| What you see | What to do |
|--------------|------------|
| Analysis fails before a model responds | A chat provider key is missing. EWI mock mode does not need one. A live MCA run needs one configured provider. A free-tier key is enough. Paid keys are not required. |
| No retrieved evidence | The knowledge base has not been indexed in this database. Re-index only if you intend to call an embedding provider. |
| Analysis stays on "starting" | Refresh the job page. The API must be running. Redis must be up so the worker can finish. |

## EWI

| What you see | What to do |
|--------------|------------|
| Many sources say unavailable | Expected with `RESEARCH_PROVIDER=mock` for providers that have no fixture. That is not a live vendor outage. |
| Word download fails when auth is on | Stay signed in. The download sends the session token. |
| No email arrived | Local email is logged, not sent. See [email.md](./email.md). |

## Docker

| What you see | What to do |
|--------------|------------|
| pgAdmin cannot connect to `localhost` | Inside pgAdmin the host name is `postgres`. |
| Containers exit immediately | `npm run docker:logs` and [docker.md](./docker.md). |
| Disk full after many runs | Images and volumes accumulate. Removing volumes deletes the database. Confirm that before `npm run docker:clean`. |

## Production droplet

| What you see | What to do |
|--------------|------------|
| Site loads on HTTP only | Finish the reverse proxy and certificate steps in [digitalocean.md](./digitalocean.md). |
| `/health/ready` returns 503 | Postgres or Redis is down. `docker compose ps` on the server. |
| Public internet can reach port 5432 | Remove that port publish and use the Docker network only. |

## Related

- [development.md](./development.md)
- [demo-guide.md](./demo-guide.md)
- [digitalocean.md](./digitalocean.md)
