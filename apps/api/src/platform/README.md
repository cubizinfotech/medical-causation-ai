# Platform (Common) layer

Reusable, product-agnostic contracts and Nest module scaffolds for MCA and EWI.

| Area | Path | Status |
|------|------|--------|
| Auth | `auth/` | Scaffold |
| Users / roles | `users/` | Scaffold |
| Email | `email/` | Scaffold |
| Audit | `audit/` | Scaffold |
| Report builders | `report/` | Types + scaffold |
| Object storage | `storage/` | Types + scaffold |
| Research/search | `search/` | Types + scaffold |
| Jobs / queue prefixes | `jobs/` | Constants in use |
| Logging constants | `logging/` | Constants |
| Products | `products.ts` | In use |

**Already implemented elsewhere (do not duplicate):**

| Concern | Location |
|---------|----------|
| Config | `src/config/` |
| Database (Prisma) | `src/database/` |
| Redis / BullMQ connection | `src/redis/` |
| AI providers / prompts / embeddings | `src/ai/` |
| Document processing / KB / indexing / RAG | `src/modules/{knowledge-base,document-processing,indexing,rag}` via `modules/common` |

Product modules must import platform/common contracts — never the other product.
