# EWI workflow

An attorney starts an Expert Witness Investigation with an expert name, a city, and a medical specialty. The API creates an investigation and runs the stages below in the background. The attorney does not approve each stage.

Redis and BullMQ carry the job. The browser shows progress over a WebSocket, and it also polls while the job is pending or running. Status values are pending, running, completed, failed, and cancelled.

A stage with no connected source, no results, an unavailable source, a rate limit, or an API error is recorded and the workflow continues. Transient provider errors are retried up to three times inside the job. Restricted sources are recorded as requiring authorized access. Their content is not stored.

The model is not a source of truth. After collection, analysis may only phrase a summary, conclusions, and questions from collected findings. See [ewi-ai-analysis.md](./ewi-ai-analysis.md). The Word report is a separate step. See [ewi-report-workflow.md](./ewi-report-workflow.md).

Local research uses fixtures. See [research-providers.md](./research-providers.md). The job does not send email. See [email.md](./email.md).

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
10. Research legal cases, motions, orders, and available references
11. Research expert witness directories
12. Research expert websites and advertising
13. Research IME-related information
14. Research YouTube, videos, and presentations
15. Research public social media
16. Research news and blogs
17. Research university and professional rules
18. Research reviews, payments, affiliations, and public records
19. Cross-check information
20. Identify inconsistencies
21. Generate investigation summary
22. Generate cross-examination questions
23. Generate final report

## What the attorney sees

The progress screen groups those stages into shorter labels. When the job completes, the history page shows the summary, findings, inconsistencies, sources, cross-examination questions, and a Word download.

Inconsistency labels come from comparing collected statements, including more than one CV when those versions were collected. The labels are Verified, Partially Verified, Conflicting, Not Verified, Not Found, and Unable to Verify. A model may phrase the summary. It does not decide the label.

Empty sections say the information could not be verified. They do not imply that a credential is absent.

## Related

- [ewi-architecture.md](./ewi-architecture.md)
- [research-providers.md](./research-providers.md)
- [ewi-report-workflow.md](./ewi-report-workflow.md)
