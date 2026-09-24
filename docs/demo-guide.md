# Demonstration guide

Use this guide on a developer machine. A DigitalOcean server is not involved. Paid API credentials are not required.

Expert Witness Investigation runs on local fixtures when `RESEARCH_PROVIDER=mock`. Medical Causation Analysis can be opened and browsed the same way. A live MCA analysis calls one chat provider. A free-tier key is enough if you want that step. Leave the key empty if you are only showing navigation, history, and EWI.

## Install

Requirements: Node.js 20 or later, npm 10 or later, Docker with Compose v2.

```bash
npm install
cp .env.example .env
npm run docker:infra
npm run prisma:migrate
```

In one terminal, `npm run dev:api`. In another, `npm run dev:web`. Open `http://localhost:3000`.

Do not run `npm audit fix --force`.

## What to leave at the defaults

| Setting | Local value | Why |
|---------|-------------|-----|
| `RESEARCH_PROVIDER` | `mock` | No research vendor is called |
| `EMAIL_PROVIDER` | `console` | Mail is logged, not sent |
| `EMAIL_DELIVERY_ENABLED` | `false` | Same |
| `AUTH_ENABLED` | `false` | MCA and EWI stay open for a quick tour |

Copy names from `.env.example`. Do not invent production passwords in this file.

## Product tour

1. The home page offers Medical Causation Analysis and Expert Witness Investigation.
2. MCA: open `/mca`, start a demo case, and watch progress if a chat provider is configured. History is under `/mca/histories`.
3. EWI: open `/ewi/intake`, enter an expert name and a specialty, and start the investigation. Progress advances without confirming each stage. The finished page includes findings, discrepancies, questions, and a Word download.

EWI will show some sources as unavailable. That is the local fixture behavior, not a missing paid account.

## Demo accounts

Turn these on only when you want to show login.

1. Set `AUTH_ENABLED=true`.
2. Set `JWT_SECRET` to any long random local string.
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

Each local account uses the password `password`. These accounts are not for production. The seed command refuses to run when `NODE_ENV=production`. Sign in at `http://localhost:3000/login`. The header shows the role. Super Admin and Admin can call `GET /auth/users`. With auth left off, the product pages stay open.

## Optional local tools

| Tool | Command | Class |
|------|---------|-------|
| pgAdmin | Included in `npm run docker:infra` | Optional |
| Mailpit | `docker compose --profile mail up -d mailpit` | Optional. Still does not email real organizations unless delivery is enabled and pointed at Mailpit |
| Ollama | `docker compose --profile local-ai up -d ollama` | Optional free local models |

## Related

- [client-overview.md](./client-overview.md)
- [authentication.md](./authentication.md)
- [troubleshooting.md](./troubleshooting.md)
- [digitalocean.md](./digitalocean.md)
