# Security

This page describes the controls that exist today and the checks to make before a public deployment. It does not replace a formal security review.

## What the application already does

- Configuration comes from environment variables. Secrets are not committed in source. `.env.example` contains names and empty or local placeholders only.
- Passwords are stored as bcrypt hashes.
- When `AUTH_ENABLED=true`, MCA and EWI HTTP routes and their sockets require a bearer token. Role checks return 403 when the signed-in user lacks the role.
- Health responses do not include connection strings.
- EWI does not store the body of a restricted source. LexisNexis stays metadata and a permitted link.
- Email defaults to the console provider, which logs the message and does not transmit it. See [email.md](./email.md).
- Research defaults to mock fixtures and does not call paid vendors. See [research-providers.md](./research-providers.md).

## Before a public site

- Set `AUTH_ENABLED=true` and a unique `JWT_SECRET`.
- Do not run `npm run seed:demo-users`. That command refuses `NODE_ENV=production`.
- Serve the site over HTTPS. See [digitalocean.md](./digitalocean.md).
- Set `FRONTEND_URL` to the public site origin so CORS is not open to every origin.
- Do not publish Postgres, Redis, or pgAdmin to the internet.
- Keep SMTP and research credentials in the server environment.
- Do not log patient narratives, expert investigation text, or passwords.

## Not in place yet

- Law-firm tenancy and per-firm data isolation
- A committed rate-limit policy for public traffic
- Centralized audit review UI
- Automated backups (see below)
- A third-party error tracker

## Optional future improvement: backups

Backup infrastructure has not been approved. Do not treat snapshots, point-in-time recovery, or an off-site copy as part of the current deployment. When the client approves a backup approach, document the tool, the schedule, and a restore test in [digitalocean.md](./digitalocean.md).

## Related

- [authentication.md](./authentication.md)
- [digitalocean.md](./digitalocean.md)
- [email.md](./email.md)
