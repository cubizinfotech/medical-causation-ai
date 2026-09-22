# Expert Witness Investigation (EWI) Architecture

EWI is a product module inside the shared monorepo (`apps/api` + `apps/web`). It is **not** part of Medical Causation Analysis (MCA).

## Purpose

Attorneys provide **Expert Name** + **Medical Specialty**. The system researches credentials, publications, legal history, and public footprint, detects discrepancies, generates **100+** cross-examination questions, and produces a **Microsoft Word (.docx)** report.

## Boundaries

| Layer | Location |
|-------|----------|
| Product module | `apps/api/src/modules/ewi/` |
| Research adapters | `apps/api/src/integrations/expert-research/` |
| HTTP / WS | `/ewi`, namespace `/ewi` |
| Database | PostgreSQL schema `ewi` |
| Redis / BullMQ | Prefix `{ewi-bull}`, queue `ewi-investigation` |
| Knowledge base | `knowledge-base/ewi/` (separate from MCA) |
| Frontend | `/ewi/*` |

MCA lives under `apps/api/src/modules/mca/` and `/mca/*`. Shared AI, document processing, indexing, and RAG stay product-agnostic.

## Pipeline

1. Intake validation  
2. Source collection via `IExpertResearchSource` (mock + stubs)  
3. Rule-based discrepancy analysis  
4. Cross-examination question generation (minimum 100)  
5. Word report assembly (`docx`)  
6. Persist investigation + report bytes in `ewi.expert_investigations`

## Local development

With no paid API keys, the **mock** source returns deterministic fixtures. Stub adapters (NPI, PubMed, CourtListener, USPTO, news, web search) skip until env keys are set.

See also: [architecture-decisions-mca-ewi.md](./architecture-decisions-mca-ewi.md), [architecture.md](./architecture.md).
