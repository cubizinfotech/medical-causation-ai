# Cost of one expert investigation

**Currency:** USD  
**Pricing retrieved:** 22 October 2026  
**Default query budget:** `WEB_SEARCH_MAX_QUERIES=64`, `WEB_SEARCH_MAX_PAGES=150`, `WEB_FETCH_MAX_PAGES=80`  
**Default web search model:** `gemini-2.5-flash`  
**Assumption:** one expert, one run, no PACER, no TrialSmith, no Lexis unless Scenario 3.

Quote-only lines are listed and **excluded** from numeric totals.

Gemini Search grounding (2.5 Flash, paid project): 1,500 grounded prompts/day free (shared with Flash-Lite), then $35 / 1,000 prompts. Source: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) (page last updated 19 Oct 2026). Token rates for 2.5 Flash: $0.30 / 1M input, $2.50 / 1M output (paid).

---

## Shared usage model (what the code actually plans)

| Step | Typical units | High units |
|---|---|---|
| Dedicated public APIs (NPI, OpenAlex, PubMed, NIH, ORCID, Open Payments, CourtListener, Justia, FL MQA) | ~20–80 HTTP calls | ~150 |
| Web grounded searches | 20–64 prompts | 64 (cap) |
| Page fetches | 10–40 | 150 cap |
| LLM wording / questions | ~50k–200k tokens combined | ~500k |
| Videos discovered (today) | 0 (web site: query) | 0 without YouTube API |
| Minutes transcribed (today) | 0 | 0 |

Returned records on the Demery Word (9) baseline: **20 items**. That is not “pages reviewed.” Many items are unread snippets.

---

## Scenario 1 — Public-source baseline (current live path)

Uses adapters that already run plus whatever search keys are already in the environment. **No new accounts.**

| Line item | Low | Typical | High | Notes |
|---|---|---|---|---|
| NPI, Open Payments, OpenAlex, PubMed, NIH RePORTER, ORCID, CourtListener, Justia, FL MQA | $0.00 | $0.00 | $0.00 | Free public |
| Gemini 2.5 Flash tokens (search + report wording) | $0.00 | $0.10 | $0.80 | Free-tier tokens $0; paid ~44×(0.5k in + 1k out) + report |
| Gemini Search grounding | $0.00 | $0.00 | $1.54 | $0 if under 1,500 RPD; 44 × $0.035 if over |
| Serper (if key present) | $0.00 | $0.04 | $0.04 | 44 × $1.00/1k |
| Brave (if key present) | $0.00 | $0.22 | $0.22 | 44 × $5.00/1k |
| Tavily (if key present) | $0.00 | $0.00 | $0.35 | Free 1k credits/month then $0.008 |
| Transcription | $0.00 | $0.00 | $0.00 | Not implemented |
| PACER / TrialSmith / Lexis | — | — | — | Not called |

**Variable total (numeric):**

| | Low | Typical | High |
|---|---|---|---|
| Gemini-only search (under daily grounding quota) | **$0.00** | **$0.10** | **$0.80** |
| Gemini over daily grounding quota | **$1.54** | **$1.64** | **$2.34** |
| Plus Serper+Brave if both keys fire all 44 queries | add **$0.26** | add **$0.26** | add **$0.26** |

**Amortized subscriptions:** $0.  
**Exclusions:** attorney time, hosting, OCR, failed retries, Google AI Studio vs billed Cloud project differences.

This scenario **does not** close board certification, depositions, video transcripts, patents, or other-state licenses.

---

## Scenario 2 — Enhanced research (selected free-key + cheap usage)

Add only after the account checklist is approved. Paid flags stay **off** until then.

| Line item | Low | Typical | High | Assumptions |
|---|---|---|---|---|
| Scenario 1 Gemini-only typical | $0.10 | $0.10 | $1.64 | Same as above |
| YouTube Data API `search.list` | $0.00 | $0.00 | $0.00 | 5–15 searches; quota 100/day; **not sold by Google as overage in the public quota table** (quota increase is a Google process, not a list price) |
| USPTO ODP | $0.00 | $0.00 | $0.00 | Inventor search |
| NCBI / OpenAlex / CL tokens | $0.00 | $0.00 | $0.00 | Rate-limit only |
| Authorized media STT (AssemblyAI $0.21/hr) | $0.00 | $0.11 | $0.42 | 0 / 30 min / 2 hours after lawful file |
| Extra Serper (video + news queries) | $0.00 | $0.02 | $0.05 | 20 extra queries |

**Variable total (numeric):**

| | Low | Typical | High |
|---|---|---|---|
| Enhanced, no STT, under Gemini RPD | **$0.10** | **$0.12** | **$0.85** |
| Enhanced + 30–120 min STT + Gemini over RPD | **$1.65** | **$1.77** | **$2.76** |

**Still excluded:** PACER, TrialSmith, Lexis, Westlaw.  
**Coverage gain:** video **metadata** (not captions), patents, better publication/grant already free. Transcripts only if a file is ingested.

---

## Scenario 3 — Premium legal research (authorization required)

| Line item | Low | Typical | High | Notes |
|---|---|---|---|---|
| Scenario 2 typical | $0.12 | $0.12 | $2.76 | |
| PACER pages via recap-fetch | $0.00 | $5.00–$30.00 | $150.00+ | $0.10/page, $3/doc cap except transcripts/searches; **$30/quarter waived**. 5 short orders vs 50 docs vs uncapped transcripts. 2027: $0.12 and $40 waiver. |
| TrialSmith membership | Quote required | Quote required | Quote required | Pro = online read; download $28–$50 each |
| TrialSmith à-la-carte downloads | $0 | $28–$150 | $50 × N | Only if not on Pro |
| LexisNexis | Quote required | Quote required | Quote required | Seat + content |
| Westlaw | Quote required | Quote required | Quote required | Seat + content |

**Numeric total (quote lines omitted):**

| | Low | Typical | High |
|---|---|---|---|
| Enhanced + PACER only, under quarterly waiver | **$0.12** | **$0.12** | **$2.76** |
| Enhanced + PACER billed | **$5** | **$10–$35** | **$150+** |
| Plus TrialSmith/Lexis/Westlaw | + quote | + quote | + quote |

**Amortized monthly:** TrialSmith/Lexis/Westlaw seats are **not** per-search fees. Allocate seat ÷ investigations/month separately once a quote exists.

**Do not imply** CourtListener recap-fetch is free document retrieval. The CL API call is free; PACER still bills the PACER account.

---

## What one Demery-class run is likely to consume

| Metric | Word (9) / current path | Enhanced (if approved) |
|---|---|---|
| Searches / API calls | Dedicated adapters + up to 44 web queries | + YouTube search.list + USPTO |
| Returned records in report | 20 items | Should rise only with attributable evidence |
| Pages with full text reviewed | Few (Head Kandy motion text; many “snippet only”) | PACER would increase this |
| Media minutes transcribed | 0 | 0 until files exist |
| LLM tokens | Grounding + question wording | Same + quote extraction |

---

## Confidence and exclusions

- **Official price:** PACER, Gemini 2.5 Flash, Brave Search, Tavily credits, NCBI limits, USPTO $0, YouTube quota, CourtListener API $0, TrialSmith download $28–$50.  
- **Calculated estimate:** per-investigation Gemini/Serper/STT line items.  
- **Unverified / quote:** Lexis, Westlaw, TrialSmith membership, Google quota increases, Azure/AWS STT regional cards.  
- **Excluded:** staff time, FOIA fees, court-reporter invoices, storage, Redis/Postgres, OCR, failed jobs, taxes.

A $0 typical Gemini line does **not** mean search is unused. It means the run likely sits inside the published free daily grounding allotment on a paid Gemini project. Confirm the live Google AI Studio vs Cloud billing account before promising $0 to the client.
