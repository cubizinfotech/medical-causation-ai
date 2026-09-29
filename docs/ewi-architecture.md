# Expert Witness Investigation (EWI) Architecture

EWI is a product module inside the shared monorepo (`apps/api` + `apps/web`). It is separate from Medical Causation Analysis (MCA).

## Purpose

An attorney starts an investigation with **Expert Name**, **City**, and **Medical Specialty**. Those three values are the primary investigation input. Later stages research credentials, publications, legal history, and public footprint, detect discrepancies, generate cross-examination questions, and produce a Microsoft Word (`.docx`) report.

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

`POST /ewi/jobs` with `{ expertName, city, specialty }` creates:

1. An `experts` row (reused when the same name, city, and specialty already exist)
2. An `investigations` row in status **pending**, stage `intake`
3. An `expert_profiles` snapshot (display name, city, and specialty)
4. An `investigation_events` audit row (`created`)

Statuses:

| Status | Meaning |
|--------|---------|
| `pending` | Accepted, research has not started |
| `running` | A research stage is in progress |
| `completed` | Findings, questions, and the generated report are stored |
| `failed` | The run stopped with an error |
| `cancelled` | Stopped by `POST /ewi/histories/:id/cancel` |

Allowed moves: `pending → running | cancelled`, `running → completed | failed | cancelled`. Terminal statuses do not move again. Progress updates cannot overwrite a concurrent cancel (atomic DB guard). A worker that finishes after cancel leaves the cancelled row unchanged.

Progress is the current backend stage id plus a 0–100 `progress` value. Stage ids match `EWI_WORKFLOW_STAGES` (for example `identify-expert`, `profiles`, `education`, `licenses`, `boards`, `publications`, `legal`, …, `questions`, `report`). The web UI maps those ids into attorney-facing timeline rows.

The history detail page shows the stage label and percent while the investigation is pending or running. The live job view uses the same stage ids over WebSocket.

## Data model (`ewi` schema)

| Table | Stores |
|-------|--------|
| `experts` | Name, city, and specialty. Reused for the same three values |
| `investigations` | Status, current stage, progress, notes, timestamps |
| `expert_profiles` | Identity snapshot for that investigation, including city |
| `research_sources` | Provider, source type, source name, URL, publication date, retrieval date, evidence status, restricted flag, restriction note |
| `research_findings` | Collected item: category, title, optional summary, source URL, source type, source name, retrieval date, relevant dates, evidence status, verification status, notes, permitted attributes |
| `discrepancies` | Inconsistencies: label, severity, field, previous value, current value, change, CV date and source, supporting source, related URLs, and the source statements in `evidence` |
| `cross_exam_questions` | Numbered questions and evidence basis |
| `investigation_reports` | Generated `.docx` file name, MIME type, local storage key, byte size, template id, template version |
| `investigation_analyses` | Model or deterministic analysis JSON, stored apart from source findings |
| `investigation_events` | Audit trail: event type, status, stage, message, timestamp |

Collected categories on `research_findings.category` are identity/profile, location, specialty, CVs, education, universities, licenses, state licensing records, board certifications, certification organizations, memberships, publications, grants, patents, awards, military claims, legal cases, orders (`court_order`), motions, depositions, testimony, directories, websites, IME information, advertising, videos, presentations, PowerPoints, social media, news, university rules, income/bias, patient reviews, office/address, corporate affiliations, criminal records, malpractice, FOIA requests, university information requests, graduation requests, and a general research finding. Inconsistencies stay on `discrepancies`. Questions and the Word report stay on the tables that already held them.

`discrepancies.label` is one of Verified, Partially Verified, Conflicting, Not Verified, Not Found, or Unable to Verify. A row also stores the field, the previous and current values, the change, the CV date and source when two CV versions were compared, the supporting source, and the source statements in `evidence`. Significant rows are stored with a lower `priority` number so they sort first. An unavailable source or a source that returned nothing is not stored as proof that a claim is absent. Same-name records that did not match city or specialty are not compared.

Indexes cover status, expert name, city, specialty, created time, provider, category, evidence status, verification status, inconsistency label, priority, and question order.

`attributes` holds category-specific fields only when the source license allows storage. Restricted items store a title, source name, source type, URL, retrieval date, and a restriction note. Summary text and document bodies are cleared. LexisNexis PDFs are not stored.

## Restricted sources

LexisNexis, commercial expert directories, social platforms, and IME advertising sites are restricted. Findings from those providers store title, URL, source type, source name, publication date, retrieval date, and verification status. Summary text, article bodies, and LexisNexis PDFs are not stored. The generated Word report is our document and is stored as a local file, not as third-party article or PDF bytes. See [ewi-report-workflow.md](./ewi-report-workflow.md).

## Workflow

Starting an investigation with expert name, city, and specialty queues a BullMQ job on `ewi-investigation`. The user does not approve each stage.

The web app collects the name, city, and specialty at `/ewi/intake`, then follows the job at `/ewi/investigation`. The screen groups the backend stages into the attorney-facing list (identifying the expert through the final report), and shows the current stage, completed stages, a failed stage when the job stops, overall progress, and status. Socket.IO updates the job, and TanStack Query refetches it while it is pending or running. A failed job can be retried from that screen.

When the job completes, `/ewi/histories/:id` shows the summary, findings, inconsistencies, source outcomes (including empty and unavailable sources), cross-examination questions, and the Word download. Raw findings stay on the investigation record. The download is `GET /ewi/histories/:id/report`.

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
10. Research memberships and professional organizations
11. Research legal cases, motions, orders and available references
12. Research expert witness directories
13. Research expert websites and advertising
14. Research IME-related information
15. Research YouTube/videos/presentations
16. Research public social media
17. Research news and blogs
18. Research university/professional rules
19. Research reviews, payments, affiliations, and public records
20. Cross-check information
21. Identify inconsistencies
22. Analyze legal materials
23. Analyze online presence
24. Analyze income and bias information
25. Generate investigation summary
26. Generate cross-examination questions
27. Generate final report

A stage with no connected source, no results, an unavailable source, a rate limit, or an API error is recorded and the workflow continues. Transient provider errors (timeout, rate limit, 502/503/504) are retried up to three times inside the job. LexisNexis and other restricted sources are recorded as requiring authorized access. Their content is not stored. Legal research builds a dossier of cases, orders, motions, pleadings, depositions, and testimony comparisons from those collected items. See [ewi-legal-research.md](./ewi-legal-research.md). Online presence builds a separate dossier for websites, directories, IME listings, videos, social profiles, news, reviews, and map locations. See [ewi-online-presence.md](./ewi-online-presence.md). Professional and financial background builds a dossier for grants, patents, trademarks, awards, military claims, memberships, organizations, affiliations, and public financial records. See [ewi-professional-background.md](./ewi-professional-background.md).

Analysis is a separate step from collection. See [ewi-ai-analysis.md](./ewi-ai-analysis.md). The model may only phrase a summary, conclusions, and questions from collected findings. Unsupported or malformed model output is discarded. Source findings and the analysis JSON are stored in different tables.

Each stage change is written to `investigation_events` and logged.

## Research providers

`createResearchPlan` returns the fixed `EWI_WORKFLOW_STAGES` list (every catalog provider once). The BullMQ worker runs `ExpertInvestigationService.investigate` → `executeInvestigationWorkflow`. Each research stage calls `ExpertResearchService.collectProviders` in parallel for that stage’s providers. Providers apply timeout and rate-limit handling and return a normalized outcome: success, no result, unavailable, restricted, authentication required, rate limited, timeout, API failure, or conflicting. One failed provider does not stop the others. A record is `matched` only when the name agrees and the city or specialty also agrees. A same-name record that does not meet that test is `uncertain` and is not merged into the expert profile. Restricted providers are not scraped. LexisNexis is authorized access only, and its PDFs are not stored.

After collection, dossier builders assemble legal, online-presence, and professional/financial views from stored findings (analyzer helpers under `modules/ewi/research/`). Nest collector service classes exist for future live adapters; the investigation workflow uses the dossier builders on collected evidence.

Information status is `verified`, `unverified`, `conflicting`, or `unavailable`. An unavailable provider returns no items. That is not a finding that the expert lacks a qualification. Development fixtures are labeled and stay `unverified` unless two collected statements disagree, in which case those items are marked `conflicting`.

`RESEARCH_PROVIDER=mock` (the local default) uses fixtures and does not call external APIs. `live` still returns unavailable for every provider until an adapter is implemented. Setting an API key does not send a request.

The stage list is in [ewi-workflow.md](./ewi-workflow.md). Provider requirements are in [research-providers.md](./research-providers.md).

## Correspondence

EWI can prepare FOIA, university, graduation, employment/activity, follow-up, and TrialSmith request emails from structured investigation data. Templates are rendered by `EwiCorrespondenceService`. `EwiRequestWorkflowService` persists drafts, enforces approval/configuration gates, records send status, and schedules follow-ups. Requests are not sent to organizations unless the workflow is enabled and authorized, a valid sending account is configured for production delivery, and a recipient is known. Manual review is the fallback when automation is not appropriate. See [ewi-request-email-workflow.md](./ewi-request-email-workflow.md).

Delivery uses the shared email service. The local default logs the message. See [email.md](./email.md).

## Local development

No paid API is required. With `RESEARCH_PROVIDER=mock`, the workflow runs on development fixtures. Providers without a fixture return unavailable and add no records.

See also: [ewi-workflow.md](./ewi-workflow.md), [ewi-report-workflow.md](./ewi-report-workflow.md), [authentication.md](./authentication.md), [architecture-decisions-mca-ewi.md](./architecture-decisions-mca-ewi.md), [architecture.md](./architecture.md).
