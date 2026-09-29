# EWI workflow

An attorney starts an Expert Witness Investigation with an expert name, a city, and a medical specialty. The API creates an investigation and queues a BullMQ job. The HTTP request returns immediately with `investigationId` and `jobId`. The attorney does not approve each stage.

Redis and BullMQ carry the job. The browser shows progress over a WebSocket, and it also polls while the job is pending or running. Investigation status values are pending, running, completed, failed, and cancelled. Product clients must use `POST /ewi/jobs`. Synchronous `POST /ewi/investigate` stays off unless `EWI_ALLOW_SYNC_INVESTIGATE=true`.

## Pipeline

1. Create investigation (persisted + queued)
2. Validate input (name, city, specialty)
3. Identify expert
4. Create research plan (every catalog provider once)
5. Queue / execute research stages
6. Run independent research providers (rate-limited, cached when safe)
7. Store normalized evidence
8. Verify identity (uncertain matches are not merged)
9. Cross-check evidence
10. Compare CVs / detect inconsistencies
11. Analyze legal materials
12. Analyze online presence
13. Analyze income/bias and professional background
14. Generate research summary
15. Generate grounded cross-examination questions (100+ when evidence supports)
16. Generate final Word report

## Provider attempt states

Each provider attempt is tracked as one of:

| Attempt status | Meaning |
|----------------|---------|
| `queued` | Not started |
| `running` | In flight |
| `completed` | Source was checked (items may still be empty) |
| `failed` | Checked and failed after retries |
| `skipped` | Not checked again (duplicate prevention) |
| `unavailable` | Checked; source unavailable |
| `restricted` | Requires authorized / paid access; content not stored |

Research disposition distinguishes:

- research completed
- research attempted but unavailable
- research not applicable (skipped)
- research requiring paid access
- research requiring manual action

A source is never shown as completed when it was not actually checked.

## Resilience

- A non-critical provider failure does not stop the investigation
- Transient errors retry with exponential backoff (up to `RESEARCH_RETRY_MAX_ATTEMPTS`)
- Providers are rate-limited (`RESEARCH_MIN_INTERVAL_MS`)
- Safe public results may be cached in-process (`RESEARCH_CACHE_TTL_SECONDS`)
- Duplicate provider searches inside one investigation are skipped
- Stage checkpoints support resume when practical
- Cancellation mid-run stops further stages and records cancelled status
- Investigation events are stored for debugging and audit

Restricted sources are recorded as requiring authorized access. Their content is not stored.

The model is not a source of truth. After collection, analysis may only phrase a summary, conclusions, and questions from collected findings. See [ewi-ai-analysis.md](./ewi-ai-analysis.md). The Word report is a separate step. See [ewi-report-workflow.md](./ewi-report-workflow.md).

Local research uses fixtures. See [research-providers.md](./research-providers.md). Legal research is described in [ewi-legal-research.md](./ewi-legal-research.md). Online presence is described in [ewi-online-presence.md](./ewi-online-presence.md). Professional and financial background is described in [ewi-professional-background.md](./ewi-professional-background.md). Request emails are prepared separately and are not sent by this job unless configured. See [ewi-request-email-workflow.md](./ewi-request-email-workflow.md).

## Stages

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
11. Research legal cases, motions, orders, and available references
12. Research expert witness directories
13. Research expert websites and advertising
14. Research IME-related information
15. Research YouTube, videos, and presentations
16. Research public social media
17. Research news and blogs
18. Research university and professional rules
19. Research reviews, payments, affiliations, and public records
20. Cross-check information
21. Identify inconsistencies
22. Analyze legal materials
23. Analyze online presence
24. Analyze income and bias information
25. Generate investigation summary
26. Generate cross-examination questions
27. Generate final report

## What the attorney sees

The progress screen groups those stages into shorter labels. When the job completes, the history page shows the summary, findings, inconsistencies, sources (with attempt status), cross-examination questions, and a Word download.

Inconsistency labels come from comparing collected statements, including more than one CV when those versions were collected. The labels are Verified, Partially Verified, Conflicting, Not Verified, Not Found, and Unable to Verify. A model may phrase the summary. It does not decide the label.

Empty sections say the information could not be verified. They do not imply that a credential is absent.

## Integration status (local mock)

Verified end-to-end with `RESEARCH_PROVIDER=mock`: intake → BullMQ queue → every `EWI_WORKFLOW_STAGES` id → Prisma persistence → AI analysis → grounded questions → Word report download. Partial failures, unavailable/restricted sources, cancel, and retry leave honest statuses (no invented success). Live vendor HTTP remains disconnected. Request/email is API-only (role-gated); there is no request UI yet.

## Related

- [ewi-architecture.md](./ewi-architecture.md)
- [research-providers.md](./research-providers.md)
- [ewi-report-workflow.md](./ewi-report-workflow.md)
- [ewi-professional-background.md](./ewi-professional-background.md)
- [ewi-request-email-workflow.md](./ewi-request-email-workflow.md)
