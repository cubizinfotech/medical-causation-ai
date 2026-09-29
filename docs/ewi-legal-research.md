# EWI legal research

Legal research runs through the shared expert-research catalog. There is no second provider stack.

`LegalResearchService` selects the legal providers. `buildLegalResearchDossier` turns collected evidence into cases, orders, motions, pleadings, depositions, and testimony comparisons. The model does not decide whether a court found an expert not credible.

## Sources

| Provider | Access | Notes |
|----------|--------|-------|
| CourtListener | Public / account | Case opinions when connected |
| Justia | Public / manual | Public case links only. No scrape of restricted pages |
| State court records | Public / manual | Legally available dockets and opinions |
| Motions | Public / manual | Docket motions the investigation supplies |
| Orders | Public / manual | Court orders |
| Pleadings | Public / manual | Complaints and related pleadings |
| Depositions | Restricted | Not scraped. Permitted metadata only |
| Expert testimony | Public / manual | Trial or hearing testimony references |
| LexisNexis | Restricted / authorized only | No request is sent from the adapter. PDFs are not stored |
| Criminal records | Restricted / authorized only | Publicly or legally available metadata only |
| Malpractice records | Restricted / authorized only | Authorized metadata only |

An unavailable source is recorded as unavailable. The investigation does not pretend that source completed a search.

## What each matter stores

When the source provides them:

- case name, case number, court, jurisdiction
- filing date and document date
- document type
- source URL
- relevance to the expert
- summary
- findings regarding the expert
- evidence reference

Restricted sources keep only permitted metadata and the source reference. Document bodies and LexisNexis PDFs are not stored.

## Orders, motions, depositions

Orders are ordered by significance first, then by date. Significance tags come from the collected `orderTags` field when the source states that the order limits the expert, strikes the expert, criticizes the expert, restricts testimony, discusses credibility or qualifications, imposes sanctions, or otherwise materially affects the expert. A tag is not inferred from free text alone.

Motions and pleadings are listed chronologically with a short description.

Depositions keep case, date, source link, transcript metadata, a short summary when permitted, important statements, and any contradictions that the comparison later attaches.

## Contradictory testimony

At the end of legal analysis, statements collected from depositions and testimony are compared when they share a topic and disagree. Agreeing statements are not listed as contradictions. Missing sources are not treated as contradictions. The comparison keeps both statements and does not choose a winner.

## Code

- `apps/api/src/modules/ewi/research/legal/` — types, normalizer, analyzer, service
- Catalog rows stay in `integrations/expert-research`
- Report section 11 renders the dossier
- History rebuilds the dossier from stored findings and attributes
