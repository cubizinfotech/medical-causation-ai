# EWI Nicole Graham — Report 3.10.16 audit → 3.10.17 fixes

Date: 2026-11-05  
Source reviewed: `ewi-nicole-graham-report.pdf` (16 pages, generated Nov 4, 2026, 4:39 PM UTC)  
Template: `ewi/investigation-report` **3.10.16**  
Intake: Nicole Graham · city `Florida` · specialty neuropsychology

## 1. Problems identified in Report 3.10.16

| Area | Defect |
| --- | --- |
| Identity | City `Florida` treated as a city; NPI 1568742435 Fort Lauderdale left “another city” / ambiguous; public pages stayed `possible` |
| Expert website overuse | `drnicolegraham.com` pages repeated across Background, Websites, and §39 Possible match |
| Criminal | Justia unread snippet about a different “Nicole E. Graham” (Wisconsin) filed under Criminal as possible match |
| Corporate | Claim for Nicole Graham, Ph.D., P.A. linked to `usbusinesslookup.com/.../acha-merrillwood-i-inc-...` |
| Office | `ca.cjis20.org` Expert-Registry.pdf dumped unrelated psychologists (Coffman, Archer, Arias, …) |
| §39 Other People | Jessica / Ryleigh / Robin / Sara / Nicole Slaughter Graham, obituaries, sports, journalists |
| Patient Reviews | Section reported “skipped” (reviews topic budget-starved) |
| Exec Summary | Promoted Criminal / Corporate / Office possible junk as selected findings |
| Education / licenses empty | Honest empty lines; Florida DOH page timed out / unread — correctly not verified |

## 2. Root causes

1. **`parseCityState('Florida')` → `{ city: 'Florida', state: null }`** — bare state names were treated as city text. NPI same-state Fort Lauderdale looked like a city mismatch; web `cityNear` never fired; specialty alone kept matches at `possible`.
2. **`tied()` / claim extraction for `possible`** — credentials were strong-only, but criminal, corporate, office, and background still accepted `possible` pages.
3. **Snippet adverse claims** — unread Justia used `factsFromSnippet`; claim text that admitted a different person still routed to Criminal.
4. **Office regex without subject-near window** — any street address on a loosely matched registry PDF became an office finding.
5. **Corporate claim ↔ URL not validated** — entity named in claim need not appear on the linked page / URL slug.
6. **§39 = dump** — `clusterRecords` printed every `other_person`, different-first, possible, and weak leftover; no ambiguity-worth filter; own-site possible pages listed again.
7. **Reviews query priority 42** — often omitted under budget → `dedicatedSearchRan` → skipped.
8. **Ellenberg 3.10.16 filters** — Glass/Thompson/Goggin name-seeds; did not generalize to Graham-class failures.

## 3. Code locations

- `apps/api/src/integrations/expert-research/live/location.ts` — bare-state parse
- `apps/api/src/integrations/expert-research/live/identity-resolver.ts` — NPI city vs state
- `apps/api/src/integrations/web-research/identity-assess.ts` — corroboration
- `apps/api/src/integrations/web-research/web-research-engine.ts` — extract for possible; domain consistency
- `apps/api/src/integrations/web-research/section-router.ts` — subject-section eligibility
- `apps/api/src/integrations/web-research/claim-topics.ts` — office/criminal rules; snippets
- `apps/api/src/integrations/web-research/identity-clusterer.ts` — §39 candidates
- `apps/api/src/modules/ewi/report/ewi-report.template.ts` — `webResearchSection`, selected findings
- `apps/api/src/integrations/web-research/query-planner.ts` — reviews priority

## 4. Corrections implemented (3.10.17)

See CHANGELOG. Key modules: `location.ts`, `identity-resolver.ts`, `identity-assess.ts`, `evidence-gate.ts`, `section-router.ts`, `identity-clusterer.ts`, `web-research-engine.ts`, `claim-topics.ts`, `query-planner.ts`, `ewi-report.template.ts`. Specs: `ewi-report.graham-regression.spec.ts`, `evidence-gate.spec.ts`. No Nicole Graham–specific URL/name bans.

## 5. Tests executed (2026-11-05)

| Suite | Result |
| --- | --- |
| `location.spec`, `identity-assess`, `identity-clusterer`, `evidence-gate`, `section-router`, `graham-regression`, `demery-regression`, `claim-topics` | Pass |
| `apps/api` + `apps/web` `tsc --noEmit` | Pass |
| PDF parse assertions in template/3107 specs | Fail environmentally (pdf.js `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`); version asserted in source |
| Live Nicole Graham Word/PDF regeneration | Not run (needs live search/fetch APIs + job runner) |

## 6. Remaining limitations

- Justia / Sunbiz / DOH CAPTCHA and timeouts remain Unable to Access (not bypassed).
- Live Graham regeneration requires live search/fetch APIs post-deploy.
- Associate name-seeds retained as Ellenberg regression fixtures until general gates fully cover them.
- No commit/push/deploy without explicit approval.
