# Platform (shared) layer

Product-agnostic services used by both MCA and EWI. Product logic does not live here.

| Area | Path | What it does |
|------|------|--------------|
| Auth | `auth/` | Login, 12-hour JWTs with revocation on logout, global `AccessGuard`, `@Public()` and `@Roles()` |
| Users | `users/` | Accounts, roles, profile, avatar |
| Audit | `audit/` | `AuditService.record()` writes `platform.audit_events` (never fails the request) |
| Rate limits | `rate-limit/` | Default limit per user/IP; `@LoginRateLimit()`, `@JobRateLimit()`, `@UploadRateLimit()` |
| Jobs | `jobs/` | BullMQ queue prefixes, shared worker options, daily job limit per user |
| HTTP | `http/` | Safe download headers; Socket.IO adapter with the website origins |
| Storage | `storage/` | Local file storage for uploads, keyed by id, path-traversal safe |
| Email | `email/` | Console, SMTP, and transactional adapters behind one service |
| Report | `report/` | Shared Word (docx) renderer |
| Health | `health/` | `/health` and `/health/ready` |
| Products | `products.ts` | Product ids (`mca`, `ewi`) |

**Implemented elsewhere (do not duplicate):**

| Concern | Location |
|---------|----------|
| Config | `src/config/` |
| Database (Prisma) | `src/database/` |
| Redis | `src/redis/` |
| AI providers / prompts / embeddings | `src/ai/` |
| Document processing / library / indexing / search | `src/modules/{knowledge-base,document-processing,indexing,rag}` via `modules/common` |

Product modules import platform code, never the other product.
