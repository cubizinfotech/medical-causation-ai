# MCA + EWI Architecture Decisions (Locked Defaults)

These defaults apply until explicitly changed. They resolve the open questions from the MCA + EWI architecture plan.

| # | Topic | Decision |
|---|--------|----------|
| 1 | Root UX | `/` is a product chooser (MCA + EWI). MCA landing moves to `/mca`. |
| 2 | MCA routes | UI under `/mca/*` with redirects from `/case`, `/analysis`, `/report`, `/histories`. |
| 3 | EWI research sources (v1) | Interface + mock fixtures for all sources. Stub adapters for NPI, PubMed/ORCID, CourtListener, USPTO, news, web search. Paid/real APIs env-gated and replaceable later. |
| 4 | Local/dev without paid APIs | Deterministic mock research fixtures when keys are absent. |
| 5 | Word report | Server-side `.docx` via `docx` library. No mandatory client Word template in v1. |
| 6 | Question count | Fixed minimum of **100** evidence-based cross-examination questions. |
| 7 | Discrepancy rules (v1) | Deterministic rule-based discrepancy stub plus evidence links; LLM used primarily for question generation. |
| 8 | PII / ethics | Treat expert as a public professional figure; retain investigation artifacts needed for report history/export; no public scrape of ToS-prohibited sources without approval. |
| 9 | KB migration | Keep current flat `knowledge-base/{books,articles,...}` as **MCA default root**. Add `knowledge-base/ewi/` for EWI. Optional `KNOWLEDGE_BASE_MCA_PATH` / `KNOWLEDGE_BASE_EWI_PATH`. |
| 10 | API prefixes | Keep `/medical-analysis` for MCA. Use `/ewi/...` for EWI. |

Related: [architecture.md](./architecture.md), [ewi-architecture.md](./ewi-architecture.md).
