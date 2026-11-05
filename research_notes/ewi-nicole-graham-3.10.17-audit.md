# Nicole Graham PDF audit → 3.10.18 (generic pipeline)

Date: 2026-11-05. Source: regenerated Graham report on template **3.10.17**.

## Remaining defects (fixed in 3.10.18)

| Report issue | Pipeline cause | 3.10.18 fix |
| --- | --- | --- |
| AACN + journal cite on own about page under Cert Orgs / Publications / Exec Summary | Own-site redirect incomplete for `other` kind + `subject_stated`; cert-orgs aggregation ungated; summary promoted subject_stated | Own-site/`subject_stated` → Websites; summary omits subject_stated credential noise |
| Four paths of same domain under Expert Websites | Cap still listed each path as its own finding | Group websites by host + “also listed” paths |
| `ca.cjis20.org` Expert-Registry.pdf under Directories | Dump gate office-only; `kind=directory` auto-filed; verified status too broad | Multi-person dump gate for directories; cautious subject-row only; no Verified for generic directory PDFs |
| Unread CourtListener RECAP notice under Pleadings | No unread gate for pleadings/orders/depositions | Require `read === 'read'` for those sections |
| NSU practicum brochure under University policy Verified | `university_rules` too broad; provider marked verified | Practicum → Background; real COI language required; university/court existence ≠ Verified |
| §39 one “possible match” bag (militarytimes + other NPI + ResearchGate + DOH) | Single `cand-possible` for all non-own possibles | Split by fingerprint + source genre |

## Out of scope (later)

Persistent research audit trail UI, human review queue, manual correct/exclude, numeric confidence score, deeper PubMed title-by-title from website bib.

## Verification

- Fixture: `ewi-report.graham-regression.spec.ts` (3.10.18 cases).
- Live Graham regen: requires post-deploy APIs; not assumed green from fixtures alone.
