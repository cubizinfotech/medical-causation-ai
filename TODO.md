# TODO

## In place

- [x] MCA case intake, background analysis, on-screen report, and case history (`/mca`)
- [x] MCA report print and PDF download (the PDF is an image of the on-screen report)
- [x] MCA medical-record upload with OCR for scanned pages, a chronology cited to the page, defense issues (bad facts), and a bills summary (medical specials)
- [x] MCA demand letter draft in Word from a finished analysis
- [x] Knowledge-base indexing into PostgreSQL (`npm run reembed:kb:full`) when the document files are on disk
- [x] EWI investigation with sample research data: intake, live progress, findings, questions, and Word download (`/ewi`)
- [x] EWI live public sources with `RESEARCH_PROVIDER=live`: NPI Registry, CMS Open Payments, OpenAlex, and CourtListener (with Daubert/Frye rulings)
- [x] EWI check of an uploaded CV against those sources
- [x] Backup script (`scripts/backup.sh`) and HTTPS setup with Caddy (`DEPLOYMENT.md` sections 21 and 22)
- [x] Cancel and retry for an EWI investigation
- [x] Shared login and roles, off unless `AUTH_ENABLED=true`
- [x] Email logged on the server until delivery is explicitly enabled
- [x] Docker for PostgreSQL, Redis, and pgAdmin
- [x] Server steps, demo steps, and product flows in `DEPLOYMENT.md`, `DEMO_GUIDE.md`, `docs/how-it-works.md`, and `docs/index.html`

## Pending

- [ ] Copy the local knowledge-base documents to the droplet and run `npm run reembed:kb:full` there (files are gitignored; steps are in `DEPLOYMENT.md`)
- [ ] Paid databases and other research sources for EWI (credentials, subscriptions, and legal access); four free public sources are live
- [ ] EWI request and email screens (the API exists; the website does not)
- [ ] Law-firm separation so one firm cannot see another firm’s cases
- [ ] Turn authentication on for any public site, with real users (do not seed the demo password)
- [ ] Production email to real organizations
- [ ] Point a domain at the droplet and start HTTPS (`DEPLOYMENT.md` section 21); the demo is IP and HTTP until then
- [ ] Schedule `scripts/backup.sh` with cron and add an off-server copy (`DEPLOYMENT.md` section 22)
- [ ] CI pipeline

EWI runs on sample data by default, or on four free public sources with `RESEARCH_PROVIDER=live`. It is not complete opposing-expert research until the paid sources, access, and firm-separation items are done.
