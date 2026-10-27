# TODO

## In place

- [x] MCA case intake, background analysis, on-screen report, and case history (`/mca`)
- [x] MCA report print and PDF download (the PDF is an image of the on-screen report)
- [x] MCA medical-record upload with OCR for scanned pages, a chronology cited to the page, defense issues (bad facts), and a bills summary (medical specials)
- [x] MCA demand letter draft in Word from a finished analysis
- [x] Knowledge-base indexing into PostgreSQL (`npm run index:kb`) when the document files are on disk
- [x] EWI investigation with sample research data: intake, live progress, findings, questions, and Word download (`/ewi`)
- [x] EWI live public sources with `RESEARCH_PROVIDER=live`: NPI Registry, CMS Open Payments, OpenAlex, and CourtListener (with Daubert/Frye rulings)
- [x] EWI check of an uploaded CV against those sources
- [x] Backup script (`scripts/backup.sh`) and HTTPS setup with Caddy (`DEPLOYMENT.md` sections 21 and 22)
- [x] Cancel and retry for an EWI investigation
- [x] Shared login and roles (always on), sign-out that ends the session on the server, 12-hour sessions
- [x] Rate limits (login, job starts, uploads), a daily job limit per user, and an audit log of access to case data
- [x] Security headers on the API (helmet), the website, and Caddy; WebSocket and CORS limited to the website address
- [x] Encrypted backups (`BACKUP_GPG_RECIPIENT` or `BACKUP_PASSPHRASE_FILE`)
- [x] CI: lint, type check, tests, and build before every deploy
- [x] Email logged on the server until delivery is explicitly enabled
- [x] Docker for PostgreSQL, Redis, and pgAdmin
- [x] Server steps, demo steps, and product flows in `DEPLOYMENT.md`, `DEMO_GUIDE.md`, `docs/how-it-works.md`, and `docs/index.html`

## Pending

- [ ] Copy the local knowledge-base documents to the droplet and run `npm run index:kb` there (files are gitignored; steps are in `DEPLOYMENT.md` section 16). On the 2 GB server, split any book near 1 GB into parts under about 200 MB first.
- [ ] Paid databases and other research sources for EWI (PACER purchase, Lexis/Westlaw, TrialSmith, FSMB, USPTO after ID.me); public-web coverage of patents, IME ads, DRI, expert directories, awards, military claims, court/news/social/accreditation searches, honest coverage wording, and a separate source-links PDF was added 26 Oct 2026 (reports 3.10.2–3.10.5) but was not deployed
- [ ] EWI request and email screens (the API exists; the website does not)
- [ ] Sharing cases inside one law firm (today each case is visible only to the user who created it)
- [ ] Create the real users on the server with `npm run user:create` (never seed demo accounts there)
- [ ] Production email to real organizations
- [ ] Turn on IP HTTPS on the droplet (`CADDYFILE=Caddyfile.ip`, `APP_IP`, `ACME_EMAIL`, rebuild the website) or point a domain at it; see `DEPLOYMENT.md` section 21
- [ ] Schedule `scripts/backup.sh` with cron, with encryption configured, and add an off-server copy (`DEPLOYMENT.md` section 22)
- [ ] Add `DEPLOY_KNOWN_HOSTS` to the GitHub secrets (deploys stop without it)
- [ ] After Caddy is in front of the apps, keep `BIND_HOST=127.0.0.1` in the server `.env`

EWI runs on sample data by default, or on four free public sources with `RESEARCH_PROVIDER=live`. It is not complete opposing-expert research until the paid sources, access, and firm-separation items are done.
