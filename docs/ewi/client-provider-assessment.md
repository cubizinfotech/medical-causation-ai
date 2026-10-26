# Client-ready EWI provider assessment

**From code paths** (`apps/api/src/integrations/expert-research/live/live-sources.ts`, `provider-catalog.ts`, `web-research-engine.ts`). Not from a live investigation log. No secrets.

**Checked in code:** 26 October 2026. **Prices:** copied from [provider-register.md](./provider-register.md), dated **22 October 2026**. **Must re-verify every price before any client email.** Do not treat this file as 26 October pricing.

A catalog label is not a completed search. A configured key is not a completed job. This document does not claim an accuracy percentage.

## How to read the table

| Column | Meaning |
|---|---|
| Contributes | What a successful call can add to an investigation record |
| Dedicated adapter | A typed provider class exists (not only a catalog row) |
| Invoked in live path | `createLiveSourceProviders` constructs it when `RESEARCH_PROVIDER=live` |
| Credential name | Env var name only |
| Depth | Listing (search hit), snippet (search excerpt), or full text (page/API body was read) |
| Limits | Code or vendor caps that apply even when the adapter runs |
| Price status | **Dated 22 Oct 2026 — re-verify** |

## 1. Callable in live mode (dedicated adapter)

| Name | Contributes | Dedicated adapter | Invoked in live path | Credential name | Depth | Limits | Price status |
|---|---|---|---|---|---|---|---|
| NPI Registry (NPPES) | Identity; self-reported licenses | Yes (`NpiRegistryResearchProvider`) | Yes | none | Full JSON | Public CMS; name search requests NPI-1 only; org NPI-2 ignored in the candidate pool | Free. Dated 22 Oct 2026 — re-verify |
| CMS Open Payments | Manufacturer payments by confirmed NPI | Yes | Yes | none | Full JSON | Needs confirmed NPI; not all income | Free. Dated 22 Oct 2026 — re-verify |
| OpenAlex | Author works, retraction flag | Yes | Yes | `OPENALEX_API_KEY`, `OPENALEX_MAILTO` (optional polite) | Metadata | Rate-limit; name collision | Free. Dated 22 Oct 2026 — re-verify |
| NIH RePORTER | NIH/HHS grants | Yes | Yes | none | Metadata | Other funders absent | Free. Dated 22 Oct 2026 — re-verify |
| PubMed (NCBI E-utilities) | MEDLINE hits | Yes | Yes | `PUBMED_API_KEY`, `PUBMED_EMAIL` | Metadata | 3 rps without key | Free. Dated 22 Oct 2026 — re-verify |
| ORCID Public API | Public record / works | Yes | Yes | `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET` | Public record | Member API is separate | Free. Dated 22 Oct 2026 — re-verify |
| CourtListener REST v4 | Opinions, RECAP metadata, some text | Yes | Yes | `COURTLISTENER_API_TOKEN` | Listing + available text | Not a complete docket; recap-fetch would bill PACER and is **not coded** | API $0. Dated 22 Oct 2026 — re-verify |
| Justia | Public case HTML | Yes | Yes | none | Listing; often unread | Bot walls common; **not** credentials | Free. Dated 22 Oct 2026 — re-verify |
| Florida DOH MQA | Official FL license / discipline | Yes (`FloridaLicenseResearchProvider`) | Yes (when city is FL or NPPES lists a FL number) | none | Official page when readable | Other states: official board **not accessed**. Blocked ≠ invalid | Free. Dated 22 Oct 2026 — re-verify |
| YouTube Data API v3 | Public video id/title/channel/caption-exists | Yes when key set | Yes **only if** `YOUTUBE_API_KEY` is set; otherwise web `site:youtube` | `YOUTUBE_API_KEY` | Listing + metadata | 100 `search.list`/day default; captions are **not** downloaded | $0 list. Dated 22 Oct 2026 — re-verify |
| Web research engine | Public pages for directories, news, social, reviews, IME ads, patents (web), awards (web) | Yes (`WebResearchEngine` + `WebSourceProvider`) | Yes when a search provider is configured | `GEMINI_API_KEY` and/or `SERPER_API_KEY` / `BRAVE_SEARCH_API_KEY` / `TAVILY_API_KEY` | Mix of listing, snippet, and read pages | Login/CAPTCHA/robots never bypassed; same-name pages are not subject credentials unless identity is strong | See §3. Dated 22 Oct 2026 — re-verify |
| Google News RSS / GDELT | News listings | Via web engine | Yes if in `WEB_SEARCH_PROVIDERS` | none | Listing (snippet), not article text | Feed limits | Free. Dated 22 Oct 2026 — re-verify |
| Crossref REST | DOI / bibliographic confirm on **CV comparison** | Client used in publication lookup, not a live catalog provider | CV lookup only | `CROSSREF_MAILTO` | Metadata | Not identity proof | Free. Dated 22 Oct 2026 — re-verify |
| AssemblyAI | Transcript of **direct public** mp3/mp4 | Enricher on the web engine | When `ASSEMBLYAI_API_KEY` and `EWI_TRANSCRIPTION_ENABLED`; cap 2 files / 30 min | `ASSEMBLYAI_API_KEY`, `EWI_TRANSCRIPTION_*` | Timestamped segments | YouTube watch URLs are **not** valid input | ~$0.21/hr batch. Dated 22 Oct 2026 — re-verify |

## 2. Status buckets (this codebase + typical laptop)

Do not commit `.env`. Re-check names on the machine before a client statement.

### Callable now (adapter + live path)

NPI, Open Payments, OpenAlex, NIH RePORTER, PubMed, ORCID, CourtListener, Justia, Florida MQA (Florida-tied experts), web engine (when Gemini/Tavily/Serper/Brave is set), Google News RSS/GDELT when selected, Crossref on CV lookup, YouTube when keyed, AssemblyAI when keyed and a direct media file is found.

### Configured on a development laptop, unused until a job runs

Keys that may be present locally (`GEMINI_API_KEY`, `TAVILY_API_KEY`, `COURTLISTENER_API_TOKEN`, `OPENALEX_*`, `PUBMED_*`, `ORCID_*`, `YOUTUBE_API_KEY`, `ASSEMBLYAI_API_KEY`) do **not** run until an investigation job is started. This workstream does not start that job.

### In code but unconfigured

| Name | Credential name | Notes |
|---|---|---|
| USPTO Open Data Portal | `USPTO_API_KEY` | Catalog-only; needs USPTO.gov + MFA + **ID.me** |
| Google Maps Platform | `GOOGLE_MAPS_API_KEY` | Catalog-only |
| Serper | `SERPER_API_KEY` | Live if set; optional |
| Brave Search | `BRAVE_SEARCH_API_KEY` | Live if set; optional |
| Generic `WEB_SEARCH_API_KEY` | `WEB_SEARCH_API_KEY` | Reserved; web engine uses named provider keys |
| Directory APIs (SEAK, DRI, ALM, JurisPro, …) | `SEAK_API_KEY`, `DRI_API_KEY`, … | Catalog labels; public pages go through the web engine |
| LexisNexis | `LEXISNEXIS_API_KEY` | Adapter never sends |
| Criminal / malpractice aggregators | `CRIMINAL_RECORDS_API_KEY`, `MALPRACTICE_RECORDS_API_KEY` | Catalog-only; not recommended |

### Docs-only / not coded

Westlaw. CourtListener **recap-fetch** (would use client PACER credentials). Manual ABPP directory. CHEA/USDE as dedicated adapters (public pages may be fetched if a web query runs). FOIA/outreach flags (`EWI_REQUEST_*`) are off and must not be described as completed.

### Extra services needing client approval

| Service | Why it is blocked |
|---|---|
| PACER (including CL recap-fetch) | Per-page fees; credential store; 180-day password rotation |
| TrialSmith / LexisNexis | Subscription; no public API for TrialSmith; Lexis adapter never sends |
| USPTO ODP | Free API but **ID.me** identity verification for the key holder |

## 3. Search / usage prices (dated 22 Oct 2026 — re-verify)

Copied from [provider-register.md](./provider-register.md). **Do not invent 26 Oct prices.**

| Provider | Published price (22 Oct 2026) | Typical investigation note |
|---|---|---|
| Gemini 2.5 Flash + Google Search grounding | $0.30 / 1M in, $2.50 / 1M out; 1,500 RPD free then **$35 / 1,000 grounded prompts** | ~44 queries: $0 if under RPD; **$1.54** if over |
| Tavily | 1,000 credits/month free then $0.008/credit | 44 basic ≈ $0.35 if over free |
| Serper | Starter **$50 / 50k** ≈ $1.00 / 1k | 44 queries ≈ $0.04 |
| Brave Search API | **$5 / 1,000** | 44 queries ≈ $0.22 |
| PACER | **$0.10/page**, $3 cap/document (not transcripts); $30/quarter waiver | Not coded; do not enable |
| AssemblyAI Universal-3.5 Pro | **$0.21 / hour** batch | 30 min ≈ $0.11 at default cap |
| TrialSmith | Subscription quote; downloads **$28–$50** | Defer |
| LexisNexis / Westlaw | Quote required | Defer |

## 4. What this is not

- Not a completed live Ellenberg (or any) investigation.
- Not permission to purchase PACER, TrialSmith, Lexis, or USPTO ID.me.
- Not a claim that NPPES licenses were board-verified.
- Not a claim that a catalog miss is a fabricated publication.
