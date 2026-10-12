# API

NestJS application for Medical Causation Analysis (MCA) and Expert Witness Investigation (EWI). Run it from the repository root with `npm run dev:api`; setup is in the root [README.md](../../README.md).

## Layout

| Folder | What lives there |
|--------|------------------|
| `src/main.ts` | Startup: helmet headers, trusted proxy (Caddy), CORS and WebSocket origins, validation |
| `src/config/` | One file per settings group; every `.env` value is read here |
| `src/platform/` | Shared by both products: auth, audit, rate limits, jobs, storage, email, Word renderer, health |
| `src/ai/` | AI providers (chat and embeddings) behind `AiService`, prompt templates |
| `src/modules/mca/` | MCA: case jobs, records (upload, OCR, chronology, bills), report, demand letter |
| `src/modules/ewi/` | EWI: investigation jobs, research stages, CV check, Word report, record requests |
| `src/modules/{knowledge-base,document-processing,indexing,rag}` | Medical library: read, chunk, embed, search |
| `src/integrations/` | PubMed / Europe PMC, NPI Registry, Open Payments, OpenAlex, CourtListener |
| `src/redis/` | Redis client, including `updateJson` for atomic job-record updates |
| `prisma/` | Schema and migrations (`npm run prisma:migrate`) |
| `scripts/` | `run-indexing.ts`, `seed-demo-users.ts`, `create-user.ts` |

MCA and EWI never import each other.

## Endpoints

Every route needs `Authorization: Bearer <token>` except the two marked public. Ids in paths are UUIDs.

| Method and path | Purpose |
|-----------------|---------|
| `GET /health`, `GET /health/ready` | Liveness; readiness of Postgres and Redis (public) |
| `POST /auth/login` | Sign in, returns a 12-hour token (public, 10 tries a minute) |
| `POST /auth/logout` | Revokes the token sent with the request |
| `GET /auth/me`, `GET/PATCH /auth/profile`, `PUT/GET/DELETE /auth/profile/avatar` | Own account |
| `GET /auth/users` | User list (admins) |
| `POST /medical-analysis/records` | Upload a PDF record (staged until an analysis uses it) |
| `GET /medical-analysis/records/:id/file`, `DELETE /medical-analysis/records/:id` | Open or remove an own record |
| `POST /medical-analysis/jobs`, `GET /medical-analysis/jobs/:jobId` | Start an analysis, read its progress |
| `GET /medical-analysis/histories[/:id]`, `DELETE /medical-analysis/histories/:id` | Own analyses |
| `POST /medical-analysis/histories/:id/demand-letter` | Draft demand letter (Word) |
| `POST /ewi/documents/cv`, `GET /ewi/documents/:id/file`, `DELETE /ewi/documents/:id` | Expert CV |
| `POST /ewi/jobs`, `GET /ewi/jobs/:jobId` | Start an investigation, read its progress |
| `GET /ewi/histories[/:id]`, `POST /ewi/histories/:id/cancel`, `DELETE /ewi/histories/:id` | Own investigations |
| `GET /ewi/histories/:id/report` | Word report |
| `/ewi/requests/*` | Record-request letters (attorneys and paralegals; off unless `EWI_REQUEST_WORKFLOW_ENABLED`) |

Live progress: Socket.IO namespaces `/medical-analysis` and `/ewi`. Connect with `auth: { token }`, then emit `subscribe` with `{ jobId }`; only the owner's jobs can be joined.

## Conventions

- **Ownership.** Every read and delete filters by `ownerUserId`; a record that belongs to someone else answers 404, never 403.
- **Background work.** Anything that calls the AI runs in a BullMQ worker (`*.processor.ts`), never inside an HTTP request. Shared worker settings are in `platform/jobs/worker-options.ts`; job progress records go through `RedisService.updateJson`.
- **Files.** Uploaded files are stored under their id by `platform/storage/local-file-storage.ts`, outside the web root. Download responses use `platform/http/download-headers.ts`.
- **Audit.** Viewing, downloading, or deleting case data calls `AuditService.record` (ids only, no patient details).
- **Limits.** New routes get the default rate limit; use `@JobRateLimit()` or `@UploadRateLimit()` from `platform/rate-limit/rate-limit.ts` for expensive ones.
- **Errors.** Return a plain message for the user; log the details. Do not put internal error text in a 500 response.

## Tests

```bash
npm test                    # unit tests (no database needed)
npm run test:e2e            # boots the app; needs Postgres and Redis
npm run lint
npm run typecheck
```
