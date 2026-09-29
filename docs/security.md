# Security

This page describes the controls that exist today and the checks to make before a public deployment. It does not replace a formal security review.

## What the application already does

- Configuration comes from environment variables. Secrets are not committed in source. `.env` is gitignored. `.env.example` contains names and empty or local placeholders only (including local Docker Postgres placeholders).
- Passwords are stored as bcrypt hashes.
- When `AUTH_ENABLED=true`, MCA and EWI HTTP routes and their sockets require a bearer token. Role checks return 403 when the signed-in user lacks the role.
- **EWI request/email control plane** (`/ewi/requests/*`) always requires an authenticated user with role `attorney`, `paralegal`, `admin`, or `super_admin`, even when other product APIs are open for local demo. Follow-up batch processing is limited to `admin` / `super_admin`. Request bodies are validated (UUID, email, array bounds, string lengths). Client SMTP credentials are never accepted on these routes.
- Health responses do not include connection strings.
- EWI does not store the body of a restricted source. LexisNexis stays metadata and a permitted link.
- Email defaults to the console provider, which logs the message and does not transmit it. SMTP passwords stay in `SMTP_PASSWORD` on the server only. SMTP failure messages are sanitized before logging. See [email.md](./email.md).
- Research defaults to mock fixtures and does not call paid vendors. Shared research HTTP rejects non-http(s) URLs, URLs with embedded credentials, and private/link-local/metadata targets before fetch. See [research-providers.md](./research-providers.md).
- OCR defaults to mock/disabled. No shell command execution for document parsing.

## Credentials and email

| Rule | Practice |
|------|----------|
| Client email password | Server env / secrets manager only (`SMTP_PASSWORD`). Never in Git, docs, seeders, `.env.example` values, frontend bundles, reports, or logs. |
| Frontend | Must not receive SMTP or research API keys. Login posts user passwords only to `/auth/login`. |
| Investigation reports | Contain research findings and links only — never mail credentials. |
| Database | Do not store SMTP or vendor API secrets in EWI request rows. |

## Before a public site

- Set `AUTH_ENABLED=true` and a unique `JWT_SECRET`.
- Keep `EWI_REQUEST_WORKFLOW_ENABLED=false` until approval/send process and SMTP are confirmed.
- Keep `EWI_REQUEST_REQUIRE_APPROVAL=true` and `EWI_REQUEST_AUTO_SEND=false` unless a written exception exists.
- Do not run `npm run seed:demo-users`. That command refuses `NODE_ENV=production`.
- Serve the site over HTTPS. See [digitalocean.md](./digitalocean.md).
- Set `FRONTEND_URL` to the public site origin so CORS is not open to every origin.
- Do not publish Postgres, Redis, or pgAdmin to the internet.
- Keep SMTP and research credentials in the server environment or a secrets manager.
- Do not log patient narratives, expert investigation free text at debug level in production aggregators, or passwords.
- Set `EMAIL_REDIRECT_TO` in non-production when testing SMTP so messages cannot reach real organizations.

## Research and access boundaries

- Do not bypass paywalls, authentication, robots restrictions, licensing restrictions, or source access controls.
- Do not access private social media accounts.
- Do not contact experts directly.
- Do not automatically send real emails in development — use `EMAIL_PROVIDER=console` or local Mailpit.
- Restricted providers (for example LexisNexis) store metadata and permitted links only.

## Not in place yet

- Law-firm tenancy and per-firm / per-investigation ownership isolation
- A committed rate-limit policy for public traffic
- Centralized audit review UI
- Automated backups (see below)
- A third-party error tracker
- DNS-rebinding-resistant SSRF protection beyond URL literal checks (vendor adapters should use fixed allowlisted hosts)

## Optional future improvement: backups

Backup infrastructure has not been approved. Do not treat snapshots, point-in-time recovery, or an off-site copy as part of the current deployment. When the client approves a backup approach, document the tool, the schedule, and a restore test in [digitalocean.md](./digitalocean.md).

## Related

- [authentication.md](./authentication.md)
- [digitalocean.md](./digitalocean.md)
- [email.md](./email.md)
- [ewi-request-email-workflow.md](./ewi-request-email-workflow.md)
- [research-providers.md](./research-providers.md)
