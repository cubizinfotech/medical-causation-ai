# TODO

## In place

- [x] MCA case intake, background analysis, on-screen report, and case history (`/mca`)
- [x] Knowledge-base indexing into PostgreSQL (`npm run reembed:kb:full`) when the document files are on disk
- [x] EWI investigation with sample research data: intake, live progress, findings, questions, and Word download (`/ewi`)
- [x] Cancel and retry for an EWI investigation
- [x] Shared login and roles, off unless `AUTH_ENABLED=true`
- [x] Email logged on the server until delivery is explicitly enabled
- [x] Docker for PostgreSQL, Redis, and pgAdmin
- [x] Server steps, demo steps, and product flows in `DEPLOYMENT.md`, `DEMO_GUIDE.md`, `docs/how-it-works.md`, and `docs/index.html`

## Pending

- [ ] Copy the local knowledge-base documents to the droplet and run `npm run reembed:kb:full` there (files are gitignored; steps are in `DEPLOYMENT.md`)
- [ ] Live research websites and paid databases for EWI (credentials, subscriptions, and legal access)
- [ ] EWI request and email screens (the API exists; the website does not)
- [ ] Law-firm separation so one firm cannot see another firm’s cases
- [ ] Turn authentication on for any public site, with real users (do not seed the demo password)
- [ ] Production email to real organizations
- [ ] MCA PDF file download (the report is on screen today)
- [ ] HTTPS and a domain name (the droplet demo is IP and HTTP)
- [ ] Database backups
- [ ] CI pipeline

EWI with sample data is ready to demonstrate. It is not ready as live opposing-expert research until the pending research, access, and firm-separation items are done.
