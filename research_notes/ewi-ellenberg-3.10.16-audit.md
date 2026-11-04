# EWI Leah Ellenberg — Report 3.10.15 audit → 3.10.16 fixes

Date: 2026-11-04  
Source reviewed: `ewi-leah-ellenberg-report.docx` (extracted to `research_notes/ewi-leah-ellenberg-report-3.10.15.txt`)

## 1. Problems identified in Report 3.10.15

| Area | Defect |
| --- | --- |
| Education | Executive summary / Education showed CV header + PII (CURRICULUM VITAE, address, phone) instead of degrees |
| Board actions | Goggin / student / principal’s-office school narrative filed as licensing/board action |
| Publications | Dr. Glass NIH/publication text attributed to Leah Ellenberg; CV page dumps treated as single publications |
| Memberships / board | Whole CV credential blocks (LICENSURE + diplomate + board) dumped into Memberships / Board |
| Orders | Law-firm commentary (“California Courts Reject… Viking River”) filed as a court order |
| Corporate | Informa Healthcare USA, Inc. from a book citation treated as corporate affiliation |
| CV comparison | 67 claims / many Unable to Access; OpenAlex used as default for appointments/education; multi-entry blobs |
| Inconsistencies | Colorado license marked Not Found / inconsistency solely because NPPES listed only CA |

## 2. Root causes

- CV / web extractors emitted page headers and multi-section blobs as single claims; education/membership filters were too weak.
- Discipline topic routed to board-actions on generic “disciplined”/complaint language without licensing-board cues; school/IEP pages were not noise-filtered.
- Associate pages (Glass) and claim text naming associates still filled subject sections.
- Order topic accepted blog/news commentary about court decisions.
- Company extraction / corporate routing treated publisher names in citations as affiliations.
- License comparison treated NPPES absence as `not_found` discrepancy; appointments/education defaulted to `unable_to_verify` when OpenAlex had no match.

## 3. Code files modified

- `apps/api/src/modules/ewi/cv/cv-comparison.ts` — education/PII filters; NPPES miss → Self-Reported; appointments/education/membership/awards Self-Reported; credential-dump filters
- `apps/api/src/modules/ewi/cv/cv-claims.ts` — junk CV claims (headers, Glass, multi-entry pubs, credential dumps)
- `apps/api/src/integrations/web-research/section-router.ts` — Goggin/school noise; Glass/associate filters; legal commentary ≠ orders; publisher ≠ corporate; education header + membership dump skips; board-action licensing cues
- `apps/api/src/integrations/web-research/web-research-engine.ts` — COMPANY_BLOCKLIST includes Informa and peer publishers
- `apps/api/src/modules/ewi/report/ewi-report.version.ts` — **3.10.16**
- Specs: `cv.spec.ts`, `section-router.spec.ts`, `ewi-report.template.spec.ts`, `ewi-report.3107-validation.spec.ts`
- Docs: `CHANGELOG.md`, `docs/ewi-workflow.md`

## 4. Corrections implemented

1. Education claims require degree/institution cues; CV headers/PII dropped.
2. School/IEP/Goggin narratives excluded; board actions need licensing-board language.
3. Associate (Glass) claims and pages excluded from subject sections (incl. awards).
4. Blog/news / “courts reject / granted review” commentary not filed under Orders.
5. Publishers (Informa, Springer, etc.) blocked from corporate affiliation.
6. NPPES miss is Self-Reported / low — not a discrepancy; confirm with state board.
7. Appointments: OpenAlex institution match remains Partially Verified only; absence is Self-Reported, not Unable to Access.
8. Multi-entry publication dumps and CV page headers rejected as publication claims.

## 5. Tests executed

| Suite | Result |
| --- | --- |
| `cv.spec.ts` | Pass |
| `section-router.spec.ts` (incl. Ellenberg regression cases) | Pass |
| `claim-topics.spec.ts` | Pass |
| `apps/api` `tsc --noEmit` | Pass |
| `apps/web` `tsc --noEmit` + production build | Pass |
| PDF parse assertions in template/3107 specs | Fail environmentally (pdf.js `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`); version bump asserted in source; not a logic regression |

## 6. Old vs new report

- **3.10.15 Word** (attached): defects above confirmed across exec summary and detail sections.
- **Live 3.10.16 Ellenberg regeneration** was not run in this environment (full investigation needs live APIs, CV upload, and job runner). Fixture routing + CV comparison unit tests reproduce and reject the exact 3.10.15 failure strings (Goggin, Glass, Viking River, CV header education, credential-dump membership).
- Client should re-run the Leah Ellenberg investigation after deploy to obtain a new Word/PDF on template **3.10.16**. Historic frozen reports are not overwritten.

## 7. Remaining limitations

- State licensing boards beyond connected Florida/NPPES paths still require manual attorney confirmation.
- LLM CV extraction can still emit imperfect single citations; junk filters reduce dumps but do not replace structured bibliography parsing for every CV layout.
- LexisNexis / TrialSmith / paid PACER remain gated when unsubscribed.
- Corporate affiliations still need Secretary of State / official role evidence; we only stop false publisher hits.
- Full end-to-end Ellenberg Word/PDF re-review awaits a post-deploy investigation run.
- Associate filters are name-seeded (Glass / Thompson / Fischer / Ellenberg practice paths); other experts’ associates need similar identity gates, not only these strings.
- Publication claims with ≥3 year tokens are treated as multi-entry dumps (residual false-drop risk for rare multi-date single citations).

## 8. Pre-push review hardenings (2026-11-04)

- Whole-record school noise narrowed to Goggin / principal’s-office patterns so special-education / IEP court filings are not dropped wholesale.
- Order commentary filter no longer treats bare “holding” or “update” as non-orders (real opinions often use those words).
- Added router regression tests for special-ed orders and opinions containing “holding”.
- Follow-up from CV/router reviews: `leftoverClaimRows` applies `isJunkCvClaim` (no dump/Glass-bio resurrection); website CV extraction runs `finalizeCvClaims`; Glass filter keeps bibliographic co-authorship; publisher filter uses `sage publications` (not bare `sage`); Informa corporate unit test added; CV comparison summary wording updated for Self-Reported vs Unable to Access.
