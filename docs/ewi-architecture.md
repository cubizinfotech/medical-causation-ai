# Expert Witness Investigation (EWI) Architecture

EWI is a product module inside the shared monorepo (`apps/api` + `apps/web`). It is separate from Medical Causation Analysis (MCA).

## Purpose

An attorney starts an investigation with **Expert Name** and **Medical Specialty**. Later stages research credentials, publications, legal history, and public footprint, detect discrepancies, generate cross-examination questions, and produce a Microsoft Word (`.docx`) report.

Research goes through `ExpertResearchService`. Each source is an independent provider. Live HTTP adapters are not connected. See [research-providers.md](./research-providers.md).

## Boundaries

| Layer | Location |
|-------|----------|
| Product module | `apps/api/src/modules/ewi/` |
| Lifecycle rules | `modules/ewi/investigation/domain/` |
| Research service and providers | `apps/api/src/integrations/expert-research/` |
| HTTP / WS | `/ewi`, namespace `/ewi` |
| Database | PostgreSQL schema `ewi` |
| Redis / BullMQ | Prefix `{ewi-bull}`, queue `ewi-investigation` |
| Knowledge base | `knowledge-base/ewi/` |
| Generated reports | `knowledge-base/ewi/reports/investigations/` (local files, gitignored) |
| Frontend | `/ewi/*` |

MCA lives under `apps/api/src/modules/mca/` and `/mca/*`. Shared AI, document processing, indexing, and RAG stay product-agnostic.

## Investigation lifecycle

`POST /ewi/jobs` with `{ expertName, specialty }` creates:

1. An `experts` row (reused when the same name and specialty already exist)
2. An `investigations` row in status **pending**, stage `intake`
3. An `expert_profiles` snapshot (display name and specialty)
4. An `investigation_events` audit row (`created`)

Statuses:

| Status | Meaning |
|--------|---------|
| `pending` | Accepted, research has not started |
| `running` | A research stage is in progress |
| `completed` | Findings, questions, and the generated report are stored |
| `failed` | The run stopped with an error |
| `cancelled` | Stopped by `POST /ewi/histories/:id/cancel` |

Allowed moves: `pending → running | cancelled`, `running → completed | failed | cancelled`. Terminal statuses do not move again. A worker that finishes after cancel leaves the cancelled row unchanged.

Progress is the current stage id plus a 0–100 `progress` value. Stage ids:

`intake`, `profile`, `credentials`, `scholarship`, `legal`, `public-web`, `discrepancy`, `questions`, `report`.

The history detail page shows the stage label and percent while the investigation is pending or running. The live job view uses the same stage ids over WebSocket.

## Data model (`ewi` schema)

| Table | Stores |
|-------|--------|
| `experts` | Name and specialty |
| `investigations` | Status, current stage, progress, notes, timestamps |
| `expert_profiles` | Identity snapshot for that investigation |
| `research_sources` | Provider, source type, URL, publication date, restricted flag |
| `research_findings` | Evidence item: title, optional summary, URL, verification status, notes |
| `discrepancies` | Severity, title, description, related URLs |
| `cross_exam_questions` | Numbered questions and evidence basis |
| `investigation_reports` | Generated `.docx` file name, MIME type, local storage key, byte size, template id, template version |
| `investigation_events` | Audit trail: event type, status, stage, message, timestamp |

Indexes cover status, expert, created time, provider, verification status, and question order.

## Restricted sources

LexisNexis, commercial expert directories, social platforms, and IME advertising sites are restricted. Findings from those providers store title, URL, source type, publication date, and verification status. Summary text is not stored. The generated Word report is our document and is stored as a local file, not as third-party article or PDF bytes. See [ewi-report-workflow.md](./ewi-report-workflow.md).

## Workflow

Starting an investigation with expert name and specialty queues a BullMQ job on `ewi-investigation`. The user does not approve each stage.

The web app collects the name and specialty at `/ewi/intake`, then follows the job at `/ewi/investigation`. The screen groups the backend stages into the attorney-facing list (identifying the expert through the final report), and shows the current stage, completed stages, a failed stage when the job stops, overall progress, and status. Socket.IO updates the job, and TanStack Query refetches it while it is pending or running. A failed job can be retried from that screen.

When the job completes, `/ewi/histories/:id` shows the summary, findings, discrepancies, source outcomes (including empty and unavailable sources), cross-examination questions, and the Word download. Raw findings stay on the investigation record. The download is `GET /ewi/histories/:id/report`.

Progress is also stored on the investigation, so a refresh can resume the same job.

Stages:

1. Identify Expert
2. Find CV and professional profiles
3. Verify education and degrees
4. Verify medical licenses
5. Verify board certifications
6. Research publications and authorship
7. Research grants
8. Research patents
9. Research awards and medals
10. Research legal cases, motions, orders and available references
11. Research expert witness directories
12. Research expert websites and advertising
13. Research IME-related information
14. Research YouTube/videos/presentations
15. Research public social media
16. Research news and blogs
17. Research university/professional rules
18. Cross-check information
19. Identify discrepancies
20. Generate investigation summary
21. Generate cross-examination questions
22. Generate final report

A stage with no connected source, no results, an unavailable source, a rate limit, or an API error is recorded and the workflow continues. Transient provider errors (timeout, rate limit, 502/503/504) are retried up to three times inside the job. LexisNexis and other restricted sources are recorded as requiring authorized access. Their content is not stored.

Analysis is a separate step from collection. See [ewi-ai-analysis.md](./ewi-ai-analysis.md). The model may only phrase a summary, conclusions, and questions from collected findings. Unsupported or malformed model output is discarded. Source findings and the analysis JSON are stored in different tables.

Each stage change is written to `investigation_events` and logged.

## Research providers

`ExpertResearchOrchestrator` calls `ExpertResearchService`. The service validates the expert name and specialty, then asks each provider in `EXPERT_RESEARCH_CATALOG`. Providers apply timeout and rate-limit handling and return normalized items with source metadata, a source URL when one exists, a retrieval timestamp, and an access class (`public`, `restricted`, or `unavailable`).

Information status is `verified`, `unverified`, `conflicting`, or `unavailable`. An unavailable provider returns no items. That is not a finding that the expert lacks a qualification. Development fixtures are labeled and stay `unverified` unless two collected statements disagree, in which case those items are marked `conflicting`.

`RESEARCH_PROVIDER=mock` (the local default) uses fixtures and does not call external APIs. `live` still returns unavailable for every provider until an adapter is implemented. Setting an API key does not send a request.

The stage list is in [ewi-workflow.md](./ewi-workflow.md). Provider requirements are in [research-providers.md](./research-providers.md).

## Correspondence

EWI can prepare request emails without sending them during an investigation. Templates cover a FOIA request, a university record request, a graduation verification, and a general client-approved research request. `EwiCorrespondenceService` renders those templates. The investigation job does not call it.

Delivery uses the shared email service. The local default logs the message. See [email.md](./email.md).

## Local development

No paid API is required. With `RESEARCH_PROVIDER=mock`, the workflow runs on development fixtures. Providers without a fixture return unavailable and add no records.

See also: [ewi-workflow.md](./ewi-workflow.md), [ewi-report-workflow.md](./ewi-report-workflow.md), [authentication.md](./authentication.md), [architecture-decisions-mca-ewi.md](./architecture-decisions-mca-ewi.md), [architecture.md](./architecture.md).
