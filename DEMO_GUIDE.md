# Medical Causation AI — Demonstration Guide

This guide walks you through installing, configuring, and demonstrating the **Medical Causation AI Platform** for clients and stakeholders.

## Project Overview

Medical Causation AI helps personal injury attorneys evaluate whether trauma or accidents medically contributed to a patient's injury or disease. The demonstration uses:

- A **private knowledge base** (indexed medical textbooks and documents)
- **Hybrid RAG retrieval** (pgvector + PostgreSQL full-text search)
- **LLM-powered medical analysis** with citation validation
- **Persistent case history** stored in PostgreSQL
- **Background job processing** with live WebSocket progress
- A **polished web UI** for case intake, analysis, reports, and history

> This is legal research assistance — not medical diagnosis or treatment advice.

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 20.x or later |
| npm | 10.x or later |
| Docker | 24.x or later |
| Docker Compose | v2 |

You also need API keys for:
- **Chat/reasoning** — Groq (free tier) or OpenRouter
- **Embeddings** — OpenRouter (recommended; no Gemini 1,000/day cap)

## Installation

```bash
# 1. Clone and enter the project
cd medical-causation-ai

# 2. Install dependencies (monorepo workspaces)
npm install

# 3. Configure environment
cp .env.example .env
```

> **Warning:** Do not run `npm audit fix --force` — it can downgrade Next.js/NestJS and break the dev server.

## Environment Configuration

Edit `.env` with these **critical** settings:

```env
# Database (Docker defaults work for local demo)
DATABASE_URL=postgresql://mca_user:mca_password@localhost:5432/medical_causation_ai

# AI — chat/reasoning (Groq free tier recommended)
AI_PROVIDER=groq
AI_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY=your-groq-key

# Embeddings (OpenRouter — batched, no daily cap)
EMBEDDING_PROVIDER=openrouter
AI_EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=768
OPENROUTER_API_KEY=your-openrouter-key

# Frontend ↔ Backend
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_TIMEOUT_MS=180000

# Knowledge base root
KNOWLEDGE_BASE_PATH=./knowledge-base
```

See `.env.example` for the full variable reference.

## Knowledge Base Setup

Place licensed PDF textbooks under:

```
knowledge-base/
├── books/        ← Medical textbooks (PDF)
├── articles/     ← Research articles
├── reports/      ← Internal reference reports
└── uploads/      ← Staging for future uploads
```

**Example:** `knowledge-base/books/ama 6th book.pdf`

### Index & embed documents

```bash
# 1. Start infrastructure
npm run docker:infra

# 2. Apply database migrations
npm run prisma:migrate

# 3. Index + embed knowledge base (first time or after adding docs)
npm run reembed:kb:full
```

Verify embeddings:

```bash
docker exec -it mca-postgres psql -U mca_user -d medical_causation_ai -c \
  "SELECT COUNT(*) AS chunks FROM documents.document_chunks; SELECT COUNT(*) AS embeddings FROM vectors.chunk_embeddings;"
```

Both counts should match (e.g. 1,486).

## Starting the Application

### Terminal 1 — Backend

```bash
npm run dev:api
```

API: [http://localhost:3001](http://localhost:3001)

### Terminal 2 — Frontend

```bash
npm run dev:web
```

Web app: [http://localhost:3000](http://localhost:3000)

---

## Client Demo — Step-by-Step Flow

Use this script when presenting to a client. Total demo time: **5–10 minutes** per case.

### Step 1 — Landing Page

**URL:** [http://localhost:3000](http://localhost:3000)

**Say:** *"This platform helps attorneys evaluate medical causation using your firm's private medical library plus AI reasoning."*

**Show:**
- Platform overview and capabilities
- How-it-works workflow
- Click **Start AI Demonstration**

---

### Step 2 — Case Intake Form

**URL:** [http://localhost:3000/case](http://localhost:3000/case)

**Say:** *"The attorney enters patient and accident details, then asks a specific medical causation question."*

**Quick start:** Click **Load Example Case** to cycle through 4 pre-built scenarios (mTBI/stroke, cervical MVA, workplace fall).

**Or fill manually:**

| Section | Example |
|---------|---------|
| Patient | Robert Chen, 52, Male |
| Accident | Motor vehicle collision, 2023-09-14 |
| Diagnosis | Acute ischemic stroke; mild TBI |
| Symptoms | Headache, confusion, right-sided weakness on day 18 |
| Medical Question | *Did the mild TBI materially contribute to the ischemic stroke?* |

**Important:** Check the **Terms of Use** acknowledgment box.

Click **Run AI Analysis**.

---

### Step 3 — Live Analysis Progress

**URL:** [http://localhost:3000/analysis](http://localhost:3000/analysis)

**Say:** *"Analysis runs in the background — one case at a time. Progress updates live via WebSocket."*

**Show the processing steps:**

1. Preparing Medical Case
2. Searching Private Knowledge Base
3. Searching Public Medical Literature
4. Ranking Medical Sources
5. Medical Reasoning
6. Generating Statistical Summary
7. Cross-Examination Questions
8. Final Report

**Typical duration:** 1–3 minutes (Groq) depending on model and rate limits.

On success, click **View Report** (opens the case in Histories).

---

### Step 4 — Case History

**URL:** [http://localhost:3000/histories](http://localhost:3000/histories)

**Say:** *"Every submitted case is saved permanently. Attorneys can return to any prior analysis."*

**Show:**
- List of all cases with status (Queued / Processing / Completed / Failed)
- Progress percentage for in-flight cases
- Click a row to open the full case detail

**Delete (optional demo):** Click **Delete** on a row → confirm in the dialog. The case and report are permanently removed.

---

### Step 5 — Full Report

**URL:** [http://localhost:3000/histories/{case-id}](http://localhost:3000/histories)

**Say:** *"The report is evidence-based, cites your private knowledge base, and is ready for attorney review."*

**Walk through report sections:**

| Section | What to highlight |
|---------|-------------------|
| Executive Summary | 2–4 sentence attorney overview |
| Confidence Score | 0–100 evidence alignment (not a diagnosis) |
| Causation Opinion | Evidence-based conclusion |
| Supporting / Opposing Evidence | Classified excerpts with page references |
| Medical Reasoning | Step-by-step causation logic |
| Timeline & Risk Factors | Case chronology and competing etiologies |
| Private Knowledge Base Sources | Human-readable citations from AMA guides / textbooks |
| Cross-Examination Questions | 50+ questions by category |
| Legal Disclaimer | No medical advice / limitations |

**Export:**
- **Export PDF** — downloads a styled multi-page PDF
- **Print** — browser print with terms & policy on the last page

---

### Step 6 — Wrap Up

**Say:** *"The platform searches your indexed medical library, applies accepted causation methodology, and produces a citable report — without replacing a licensed medical expert."*

Point to:
- [Terms of Use](/terms) and [Privacy Policy](/privacy)
- Knowledge base can be expanded by adding PDFs and re-running `npm run reembed:kb`

---

## Expected AI Pipeline

```
Knowledge Base (PDFs in knowledge-base/)
        ↓
Document Processing (PDF/DOCX/TXT/MD parsing)
        ↓
Chunking (token-aware splits)
        ↓
Embeddings (OpenRouter text-embedding-3-small)
        ↓
Vector Indexing (PostgreSQL + pgvector)
        ↓
Hybrid Retrieval (vector + keyword + RRF fusion)
        ↓
Context Builder (dedup, token limits, citations)
        ↓
Medical Analysis (Groq LLM + citation validation)
        ↓
Report Enrichment (timeline, cross-exam, references)
        ↓
PostgreSQL case history + full report UI
```

## API Endpoints (Demo)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/medical-analysis/jobs` | Submit case for background analysis |
| `GET` | `/medical-analysis/jobs/:jobId` | Poll job status |
| `GET` | `/medical-analysis/histories` | List case history |
| `GET` | `/medical-analysis/histories/:id` | Case detail + report |
| `DELETE` | `/medical-analysis/histories/:id` | Delete case (with confirmation in UI) |
| WebSocket | `/medical-analysis` | Live job progress events |

## Known Limitations

| Limitation | Notes |
|------------|-------|
| No authentication | Open demo — no user accounts |
| File upload is display-only | Uploaded files are not sent to the API |
| Public literature is simulated | PubMed/NIH references are demo placeholders |
| One analysis at a time | Queue processes cases sequentially |
| Groq free tier limits | ~1,000 requests/day, 100K tokens/day on llama-3.3-70b |
| Analysis latency | 1–5 minutes depending on model and rate limits |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `No retrieved evidence available` | Run `npm run reembed:kb:full` after embedding model changes |
| Analysis fails at Medical Reasoning | Restart API; ensure Groq key is set; check JSON parse fix is deployed |
| Gemini embedding quota (429) | Use OpenRouter for embeddings (`EMBEDDING_PROVIDER=openrouter`) |
| Analysis stuck / canceled | Run `npm run docker:infra` (Redis required) |
| CORS errors | Set `FRONTEND_URL=http://localhost:3000` |
| Database connection failed | Run `npm run docker:infra` |

## Related Documentation

- [README.md](./README.md)
- [docs/frontend-demo.md](./docs/frontend-demo.md)
- [docs/medical-analysis.md](./docs/medical-analysis.md)
- [docs/indexing.md](./docs/indexing.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
