# EWI research platform — audit, providers, and costs

These notes are the Phase A–H deliverables for Dorothy Clay Sims’s Expert Witness Investigation work. They describe what the live pipeline actually does, which providers are real versus catalog labels, and what should be enabled only after client approval.

**Checked:** 22 October 2026. **Currency:** USD. **Do not treat this folder as proof that a search ran.**

| Document | Contents |
|---|---|
| [capability-audit.md](./capability-audit.md) | Runtime vs catalog; Jason A. Demery Word report (9) baseline; coverage matrix |
| [provider-register.md](./provider-register.md) | Provider/API register, free vs paid matrix, terms (prices dated **22 Oct 2026 — re-verify**) |
| [client-provider-assessment.md](./client-provider-assessment.md) | Client-ready table from **code paths** (26 Oct 2026): adapter vs live path, credential **names**, depth, approval-gated services |
| [investigation-cost-estimate.md](./investigation-cost-estimate.md) | Three cost scenarios for one expert investigation |
| [integration-plan.md](./integration-plan.md) | Implementation order, account checklist, security checklist, draft client email |

Related workflow: [../ewi-workflow.md](../ewi-workflow.md).

## Stop conditions (still in force)

- No paid API, PACER fetch, TrialSmith, LexisNexis, or Westlaw call until approved.
- Do not overwrite live PDF `knowledge-base/ewi/reports/investigations/192fdaa2-2c1d-4477-a1ff-9c81b2cf65e9.pdf` (template 3.9.0).
- Do not alter historic job `9a1823db-f412-4f7d-ad2c-45d1a30a1881`.
- Do not commit or push from this workstream unless asked.
- YouTube Data API `captions.download` requires permission to **edit** the video. It cannot retrieve third-party captions. Do not scrape YouTube timed text.
