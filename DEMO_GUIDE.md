# Medical Causation AI — Demonstration Guide

This guide walks you through installing, configuring, and demonstrating the **Medical Causation AI Platform** for stakeholders and developers.

## Project Overview

Medical Causation AI helps personal injury attorneys evaluate whether trauma or accidents medically contributed to a patient's injury or disease. The demonstration uses:

- A **private knowledge base** (indexed medical textbooks and documents)
- **Hybrid RAG retrieval** (pgvector + PostgreSQL full-text search)
- **LLM-powered medical analysis** with citation validation
- A **polished web UI** for case intake and live analysis

> This is legal research assistance — not medical diagnosis or treatment advice.

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 20.x or later |
| npm | 10.x or later |
| Docker | 24.x or later |
| Docker Compose | v2 |

You also need API keys for at least one AI provider (OpenRouter recommended).

## Installation

```bash
# 1. Clone and enter the project
cd medical-causation-ai

# 2. Install dependencies (monorepo workspaces)
npm install

# 3. Configure environment
cp .env.example .env
```

> **Warning:** Do not run `npm audit fix --force` — it can downgrade Next.js/NestJS and break the dev server. If dependencies get corrupted, delete `node_modules` and `package-lock.json`, restore `package.json` files from git, then run `npm install` again.

## Environment Configuration

Edit `.env` with these **critical** settings:

```env
# Database (Docker defaults work for local demo)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=mca_user
POSTGRES_PASSWORD=mca_password
POSTGRES_DB=medical_causation_ai
DATABASE_URL=postgresql://mca_user:mca_password@localhost:5432/medical_causation_ai

# AI — use a CHAT model, not a rerank model
AI_PROVIDER=openrouter
AI_CHAT_MODEL=openai/gpt-4o-mini
OPENROUTER_API_KEY=your-key-here

# Embeddings (must match indexed data)
EMBEDDING_PROVIDER=openrouter
AI_EMBEDDING_MODEL=openai/text-embedding-3-small

# Frontend ↔ Backend
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_TIMEOUT_MS=180000

# Knowledge base root
KNOWLEDGE_BASE_PATH=./knowledge-base
```

See `.env.example` for the full variable reference.

## Knowledge Base Setup

### Where to Place Medical Books

Place licensed PDF textbooks and documents under:

```
knowledge-base/
├── books/        ← Medical textbooks (PDF)
├── articles/     ← Research articles
├── reports/      ← Internal reference reports
├── templates/    ← Report templates
└── uploads/      ← Staging for future uploads
```

**Example:** `knowledge-base/books/ama 6th book.pdf`

See [knowledge-base/README.md](./knowledge-base/README.md) for organization guidelines.

## Indexing Documents

Before RAG retrieval works, documents must be indexed (chunked + embedded + stored in pgvector).

### 1. Start infrastructure

```bash
npm run docker:infra
```

### 2. Run Prisma migrations (if not already applied)

From the project root or `apps/api` (both load the root `.env` automatically):

```bash
npm run prisma:migrate
```

Or from `apps/api`:

```bash
cd apps/api
npm run prisma:migrate
```

### 3. Index the knowledge base

Use the indexing pipeline via the NestJS application context or existing indexing scripts/workflows documented in [docs/indexing.md](./docs/indexing.md).

Verify indexed data:

```bash
docker exec -it mca-postgres psql -U mca_user -d medical_causation_ai -c "SELECT COUNT(*) AS chunks FROM documents.document_chunks; SELECT COUNT(*) AS embeddings FROM vectors.chunk_embeddings;"
```

You should see chunk rows for each indexed document (embeddings count should match chunks).

## Starting the Application

### Terminal 1 — Backend

```bash
npm run dev:api
```

API listens on [http://localhost:3001](http://localhost:3001)

### Terminal 2 — Frontend

```bash
npm run dev:web
```

Web app at [http://localhost:3000](http://localhost:3000)

### Optional — Full Docker stack

```bash
docker compose up -d --build
```

## Demonstration Workflow

### Step 1 — Landing Page

Open [http://localhost:3000](http://localhost:3000)

- Review platform overview, features, and workflow
- Click **Start AI Demonstration**

### Step 2 — Medical Case Form

Navigate to [http://localhost:3000/case](http://localhost:3000/case)

**Quick start:** Click **Load Example Case** repeatedly to cycle through 4 scenarios (mTBI/stroke, cervical MVA, workplace fall). See [`docs/demo-case-example.md`](docs/demo-case-example.md).

Fill in manually if preferred:

| Section | Example |
|---------|---------|
| Patient | Robert Chen, 52, Male |
| Accident | Motor vehicle collision, 2023-09-14 |
| Diagnosis | Acute ischemic stroke; mild TBI from collision |
| Symptoms | Headache, confusion, then right-sided weakness on day 18 |
| Medical Question | *Did the mild TBI materially contribute to the ischemic stroke?* |

Optionally attach PDF/DOCX files (display only — not sent to API in this phase).

Click **Run AI Analysis**.

### Step 3 — AI Processing Screen

You are redirected to [http://localhost:3000/analysis](http://localhost:3000/analysis)

Watch the animated progress steps:

1. Preparing Medical Case
2. Searching Knowledge Base
3. Searching Scientific Evidence
4. Ranking Medical Sources
5. Building Context
6. Analyzing Medical Literature
7. Generating Medical Reasoning
8. Preparing Professional Report

The page calls `POST /medical-analysis/analyze` on the real backend.

### Step 4 — Review Report

On success you are redirected to [http://localhost:3000/report](http://localhost:3000/report) with:

- Executive summary with statistical conclusion (AI-generated)
- Confidence score, causation opinion, supporting/opposing evidence
- Timeline, risk factors, public & private references
- 50 cross-examination questions by category
- Export to Markdown or print

> You must accept the Terms disclaimer on the case form before analysis runs.

## Expected AI Pipeline

```
Knowledge Base (PDFs in knowledge-base/)
        ↓
Document Processing (PDF/DOCX/TXT/MD parsing)
        ↓
Chunking (token-aware splits)
        ↓
Embeddings (OpenRouter / OpenAI / etc.)
        ↓
Vector Indexing (PostgreSQL + pgvector)
        ↓
Hybrid Retrieval (vector + keyword + RRF fusion)
        ↓
Context Builder (dedup, token limits, citations)
        ↓
Medical Analysis (LLM + citation validation)
        ↓
Structured JSON result → UI preview
```

## Manual API Test

```bash
cd apps/api
npx ts-node -r tsconfig-paths/register scripts/run-medical-analysis.ts \
  "Can mild traumatic brain injury increase the risk of stroke?"
```

## Known Limitations

| Limitation | Notes |
|------------|-------|
| No authentication | Open demo — no user accounts |
| No PDF report export | Analysis preview only on `/analysis` |
| No dedicated `/report` page | Full report viewer not yet built |
| File upload is display-only | Uploaded files are not processed |
| No PubMed / external literature | Private KB only in current demo |
| No case history | Session storage only |
| Analysis latency | 20–60+ seconds depending on model and KB size |
| `AI_CHAT_MODEL` must be a chat model | Rerank models will fail |

## Future Roadmap
 
| Phase | Focus |
|-------|-------|
| 2e | Health checks, Swagger, remaining REST APIs |
| 4 | Full analysis report viewer |
| 5 | Authentication + multi-tenant law firms |
| 6 | PubMed / PMC / Semantic Scholar integration |
| 7 | Professional PDF report generator |
| 8 | Admin panel, audit logs |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `No retrieved evidence available` | Index knowledge base documents first |
| Analysis timeout | Increase `NEXT_PUBLIC_API_TIMEOUT_MS` to `180000` |
| LLM errors | Set `AI_CHAT_MODEL` to a valid chat model |
| CORS errors | Ensure `FRONTEND_URL=http://localhost:3000` |
| Database connection failed | Run `npm run docker:infra` |

## Related Documentation

- [README.md](./README.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [docs/frontend-demo.md](./docs/frontend-demo.md)
- [docs/medical-analysis.md](./docs/medical-analysis.md)
- [docs/indexing.md](./docs/indexing.md)
