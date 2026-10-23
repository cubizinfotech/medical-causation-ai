# Integration plan, checklists, and client email

**Date:** 22 October 2026  
**Rule:** small reviewable steps. Paid integrations stay disabled until credentials and approval exist. Do not commit or push from this workstream unless asked.

---

## 1. Prioritized implementation order

| Phase | Work | Depends on | Coverage gain | Paid? | Status |
|---|---|---|---|---|---|
| P0 | Stop court/Justia pages filing as board certification, license, IME, or testimony inconsistency | Existing `section-router` | Fixes Word (9) credential misfile | No | **Done in working tree** (tests added). Live 3.9.0 PDF **not** rebuilt |
| P0 | Honest coverage language already in template 3.9.2 | Uncommitted report rebuild | Distinguishes no-result vs not-implemented vs blocked | No | In working tree; Word (9) still a prior export |
| P1 | YouTube Data API **search/list metadata only**; store video id, title, channel, date, URL; identity gate | Google Cloud project + `YOUTUBE_API_KEY`; enabled when the key is set | Real video discovery vs `site:youtube` | $0 quota | **Done** (captions still not retrieved) |
| P1 | Manual video/file ingest + STT flag default **false** | P1 discovery or user URL | Transcripts with timestamps | STT usage | **Not started** |
| P1 | USPTO ODP inventor search | USPTO.gov + ID.me key; flag default **false** | Patents section | $0 | **Not started — needs key holder** |
| P1 | ABPP.org / AACN routing: only official hosts for `board_certification` | `officialSourceFor` already used for licenses | Stop leftover web “ABPP” claims | No | Next unpaid code step |
| P2 | CourtListener existing text fields first; recap-fetch **off** | `COURTLISTENER_API_TOKEN` | More full text when RECAP already has it | $0 | Improve existing adapter; no PACER |
| P2 | PACER recap-fetch | Client PACER account in secret store; budget cap; flag default **false** | Underlying motions/orders | PACER fees | **Stop until approved** |
| P2 | Per-investigation spend ledger | Usage tracking | Stop at budget | — | Design with P2 PACER/STT |
| P3 | TrialSmith / Lexis / Westlaw | Quotes + licenses | Real depositions | Quote | **Stop.** No public API for TrialSmith |
| P3 | Other-state license boards | Per-state ToS | Non-FL licenses | Varies | Case-by-case |
| Never | YouTube caption scrape; paywall bypass; criminal mills | — | — | — | Rejected |

Do **not** build a second CourtListener or PubMed adapter. Do **not** silently fail over from free to paid.

---

## 2. Client account checklist (non-developer)

Create accounts **only after you approve this list**. Nothing here is required for the P0 routing fix already in the working tree.

### Create first (free, high value) — when you say go

| # | Service | What it is for | Account type | What you do | Permissions | Needed now? |
|---|---|---|---|---|---|---|
| 1 | **Google Cloud project + YouTube Data API v3** | Find public videos by name (title, channel, date, URL). **Not** captions. | Free Google Cloud project; enable YouTube Data API; API key restricted to that API | Create project → APIs & Services → enable YouTube Data API → create API key → restrict key | Public metadata only. Do **not** request `youtube.force-ssl` (that is for **your** videos’ captions) | **Later** — first optional account if video research is the priority |
| 2 | **CourtListener API token** (if not already in env) | Higher-quality RECAP/opinion search | Free Law Project account | courtlistener.com → API token | Public court data | **Later** if token missing |
| 3 | **USPTO.gov + ID.me** | Patent search API key | Free USPTO.gov with MFA; link ID.me (identity documents) | account.uspto.gov → link ID.me → Open Data Portal → Manage API Key | One personal key; do not share | **Later** — patents are currently “not implemented” |
| 4 | **NCBI API key** (if PubMed is rate-limited) | Faster PubMed | Free NCBI account | Account settings → API Key Management | Public MEDLINE | Optional |

### Wait (paid or operationally heavy)

| Service | Why wait |
|---|---|
| **PACER** | $0.10/page ($0.12 in 2027). CourtListener recap-fetch would use **this** login and **this** bill. Password must rotate every 180 days. Do not put the password in `.env` committed files. |
| **AssemblyAI / Google STT / Deepgram** | Only useful after we have a lawful audio/video file. Discovery does not produce a file by itself. |
| **Serper paid pack** | Only if Gemini grounding is insufficient. Starter $50 / 50k credits. |
| **Brave Search credits** | $5 / 1,000. Optional fallback. |

### Optional / quote — do not create until a lawyer wants depositions or paid dockets

| Service | Who it is for | What you get | What you do not get |
|---|---|---|---|
| **TrialSmith** | Qualified **plaintiff** lawyers | Deposition library; Pro = online read; download $28–$50 | No public API. Do not scrape. Membership quote required. |
| **LexisNexis** | Firm subscription | Licensed dockets/pubs | Adapter does not call it today |
| **Westlaw** | Firm subscription | Licensed research | No adapter |
| **SEAK / JurisPro / ALM** | Directory listings | Manual export if subscribed | We will not scrape login pages |

### Do not create

| Service | Reason |
|---|---|
| Unofficial YouTube transcript tools | Terms; owner-only official captions |
| Consumer “criminal background” APIs | Unreliable identity; false negatives |
| Extra Google Maps key | Unused; not the credential gap |

---

## 3. Security checklist

| Topic | Requirement |
|---|---|
| Secrets | Store in the existing secret env / host store. Names only in `.env.example`. Never commit values. |
| PACER / TrialSmith passwords | Secret manager, not plaintext `.env` in git. PACER password rotation 180 days. |
| OAuth | ORCID already has an OAuth module. YouTube captions OAuth is **out of scope** (owner videos only). |
| Feature flags | New paid paths default **false**. No silent fallback from free → paid. |
| Budgets | Per-investigation caps before PACER or STT. Stop and report unsearched remainder. |
| Retention | Store transcript text only with source URL, retrieval date, provider, and license note. Do not assume a transcript may be redistributed in the client PDF if the media license forbids it. |
| Access | Same investigation ACL as today; reports stay owner-only. |
| Identity | Possible matches stay possible. No name-only attribution of videos, licenses, or patents. |
| Logging | Redact API keys (existing redact util). Log provider id, units, estimated USD, not secrets. |
| Tests | Fixtures only. No live paid calls in `npm test`. |

---

## 4. Implementation summary (this workstream)

**Not committed. Not pushed.**

### Files changed (this pass)

- `apps/api/src/integrations/web-research/section-router.ts` — court/Justia claims no longer file as board certification, license, education, IME/advertising, deposition, or testimony-inconsistency. Orders/motions still file by document type.
- `apps/api/src/integrations/web-research/section-router.spec.ts` — regression for Justia/PACER pages.
- `apps/api/src/modules/ewi/report/ewi-report.demery-regression.spec.ts` — board-certification and IME sections must not contain the PACER order URL.
- `docs/ewi/*` — audit, register, costs, this plan.
- `docs/ewi-workflow.md` — pointer to the new docs.
- `CHANGELOG.md` — unreleased note.
- `.env.example` — reserved-key comments only.

### Already in the working tree from 3.9.2 (preserved, not discarded)

Report rebuild-from-evidence, caption slug heuristics, question filters, coverage semantics. Historic job `9a1823db-…` untouched. Live `192fdaa2` 3.9.0 PDF not overwritten.

### Tests run

`npm test -- src/integrations/web-research/section-router.spec.ts src/modules/ewi/report/ewi-report.demery-regression.spec.ts` — 2 suites, 27 tests, all passed. Paid APIs were not called.

### Integrations verified live in this pass

**None.** No new provider was invoked. The routing change is unit-tested with fixtures.

### Remaining defects (honest)

- Word (9) and live 3.9.0 PDF still show the old board-certification Justia URL until a **approved** rebuild.
- Education, accreditation, depositions, criminal, malpractice (NPDB), patents, military, awards: still not implemented as dedicated sources.
- Video path is still `site:youtube.com` until YouTube Data API is approved and coded.
- YouTube official captions cannot be downloaded for other people’s videos.
- Legal items often remain snippets; PACER fetch is off.
- Questions can still be weak where evidence is a biography blurb.
- Identity of same-name videos/profiles remains unsolved without extra attributes.

---

## 5. Report acceptance (Phase H)

| Check | Result |
|---|---|
| Live 3.9.0 PDF overwritten? | **No** |
| Historic job mutated? | **No** |
| Word (9) regenerated? | **No** — it remains the client baseline |
| Review PDF from earlier 3.9.2 work | Exists under preserved-reports; **not** re-issued in this pass |
| Unimplemented categories labeled complete? | Word (9) still misfiles board cert; code fix not in that file |
| Transcript links/timestamps | None exist; correctly not claimed as implemented |
| Coverage matrix / cost visible in the PDF? | **Not yet** — documented here first, not silently added to the live report |
| Unsupported claims removed? | Only in code path; reports on disk unchanged |

Regeneration of a **separate** review artifact for `192fdaa2` still requires explicit approval.

---

## 6. Draft client email (send only after you review)

Subject: Expert research sources — what works now, and what would need your approval

```
Dorothy,

We audited the current Expert Witness Investigation pipeline against the Jason A. Demery report (Word export dated 22 October 2026). This is a research and cost note, not a claim that the investigation is comprehensive.

What already runs at no extra subscription cost
- NPI Registry (identity; licenses are self-reported)
- CMS Open Payments (by confirmed NPI)
- PubMed, OpenAlex, ORCID, NIH RePORTER, Crossref (publications/grants)
- CourtListener and Justia (public opinions and some RECAP filings; often snippets, not a full docket)
- Florida license lookup when the Department of Health page can be read (it is often blocked)
- Web search via the existing Gemini key (Google Search grounding). That can incur usage if we exceed Google’s daily free grounding allotment (1,500 grounded prompts/day on Gemini 2.5 Flash paid projects; then $35 per 1,000 prompts). A typical run plans up to 44 searches.

What the Demery report still does not do
- Board certification was listed from a Justia court URL. That is not ABPP verification. We have stopped that mis-filing in code; we have not replaced your live PDF.
- Education/accreditation, depositions, criminal databases, NPDB malpractice, patents, military claims, and video transcripts are not implemented as dedicated sources.
- “No matching record” on YouTube was a web query, not a YouTube account search, and not a transcript.

We are not asking you to subscribe to everything. If you want the next increment of coverage, these are the only accounts worth creating first:

1. Google Cloud — YouTube Data API (free daily quota, 100 searches/day). Finds public videos (title, channel, date, URL). It cannot legally download other people’s captions.
2. USPTO.gov + ID.me — free patent API key, after identity verification.
3. CourtListener token — free, if we do not already have one.

Please do not create yet:
- PACER (federal document fees: $0.10/page, $3 cap on most documents, $30/quarter usually waived; $0.12 and $40 waiver from 1 Jan 2027). We would only use this with a written budget.
- TrialSmith (plaintiff-lawyer membership; quote; $28–$50 per downloaded transcript; no public API).
- LexisNexis or Westlaw (firm quote).
- A transcription vendor, until we have a video we are allowed to process. Automated speech-to-text is typically well under $1 per hour of audio at published AssemblyAI/Google batch rates, but that does not include finding or licensing the media.

Estimated variable cost per investigation at current settings
- Public sources + Gemini under the daily grounding allotment: about $0.00–$0.80.
- Same run after the daily grounding allotment is exhausted: about $1.50–$2.50 extra.
- PACER, TrialSmith, and Lexis are extra and need a quote or a page budget before we turn them on.

We will not buy documents, create those accounts, or overwrite the live Demery PDF until you say so.

Regards
```

---

## 7. Stop — awaiting your decisions

1. Approve or reject: Google Cloud YouTube Data API (search only).  
2. Approve or reject: USPTO.gov + ID.me for patents.  
3. Do **not** approve PACER, TrialSmith, Lexis, or STT until (1)–(2) and a budget are explicit.  
4. Approve or reject: generate a **new** 3.9.2 review PDF for job `192fdaa2` without replacing the live 3.9.0 file.  
5. Do not commit/push until you have reviewed the working tree.
