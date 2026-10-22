# EWI provider and API register

**Last checked:** 22 October 2026  
**Currency:** USD  
**Rule:** public documentation ≠ free usage. Catalog presence ≠ runtime call.

Integration status values: **working** (adapter invoked in live mode), **partial** (search or metadata only), **catalog-only** (label / reserved env), **proposed** (documented here, not coded).

---

## 1. Free public sources

| Provider | Category | Capability | Status | API / access | Pricing | Account | Published price | Est. / investigation | Confidence | Limits | Secrets (names only) | Effort | Coverage benefit | Terms / restrictions | Rec. | Official references |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NPI Registry (NPPES) | Identity, self-reported licenses | Search + metadata | Working | Official REST | Free | No | $0 | $0 | Official | Public CMS | none | — | Confirmed identity before attribution | Self-report; not a license board | Use | [npiregistry.cms.hhs.gov](https://npiregistry.cms.hhs.gov/) |
| CMS Open Payments | Financial conflicts | Search by NPI | Working | Official REST | Free | No | $0 | $0 | Official | Public dataset | none | — | Manufacturer payments | Not all income; delay in publication | Use | [openpaymentsdata.cms.gov](https://openpaymentsdata.cms.gov/) |
| OpenAlex | Publications | Search, metadata, retraction flag on works | Working | REST | Free | Optional polite key | $0 | $0 | Official | Polite pool with mailto/key | `OPENALEX_API_KEY`, `OPENALEX_MAILTO` | — | Author works + retract status | Rate-limit; name collision | Use | [docs.openalex.org](https://docs.openalex.org/) |
| NIH RePORTER | Grants | Search + metadata | Working | Official API | Free | No | $0 | $0 | Official | Public | none | — | NIH/HHS grants | Other funders absent | Use | [api.reporter.nih.gov](https://api.reporter.nih.gov/) |
| ORCID Public API | Identity, works | Search + public record | Working | REST; client credentials optional | Free | Free registration for client id | $0 | $0 | Official | Public records only | `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET` | — | Disambiguation when iD known | Member API is separate | Use | [info.orcid.org](https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/) |
| Crossref REST | Publications | DOI / bibliographic metadata | Partial (CV lookup only) | REST | Free | Optional mailto | $0 | $0 | Official | Polite pool | `CROSSREF_MAILTO` | Small | DOI confirmation | Not identity proof | Use | [api.crossref.org](https://api.crossref.org/) |
| CourtListener REST v4 | Legal | Search, opinions, RECAP metadata, some plain text | Working | REST + token | Free API | Free token recommended | $0 API | $0 | Official | Token raises limits | `COURTLISTENER_API_TOKEN` | — | Federal opinions + public RECAP | Not complete docket; recap-fetch bills PACER | Use | [courtlistener.com/help/api/rest](https://www.courtlistener.com/help/api/rest/) |
| Justia | Legal | Public case HTML search | Partial | Site search (no official API) | Free | No | $0 | $0 | Calculated | Bot walls common | none | — | Extra captions | Often unread; **not** credentials | Use (legal only) | [law.justia.com](https://law.justia.com/) |
| Google News RSS / GDELT | News | Search listings | Working if in `WEB_SEARCH_PROVIDERS` | Public feeds | Free | No | $0 | $0 | Official | Feed limits | none | — | News leads | Not full article text | Use | GDELT / Google News RSS docs |
| Florida Sunbiz | Corporate | Manual / HTML | Partial (web fetch, often 403) | Public website | Free | No | $0 | $0 | Official | Bot protection | none | Medium | FL entities | Do not bypass 403 | Optional | [search.sunbiz.org](https://search.sunbiz.org/) |
| Florida DOH MQA | License, discipline | Official lookup | Partial | Official pages; no stable public API | Free | No | $0 | $0 | Official | Bot / session walls | none | — | Issuing-body license when readable | Blocked ≠ invalid | Use | [mqa-internet.doh.state.fl.us](https://mqa-internet.doh.state.fl.us/) |

---

## 2. Free registration / API-key sources

| Provider | Category | Capability | Status | API / access | Pricing | Account | Published price | Est. / investigation | Confidence | Limits | Secrets | Effort | Benefit | Terms | Rec. | References |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NCBI E-utilities (PubMed) | Publications | Search + summaries | Working | Official | Free | Optional NCBI key | $0 | $0 | Official | 3 rps; 10 rps with key | `PUBMED_API_KEY`, `PUBMED_EMAIL` | — | MEDLINE hits | Register tool+email; no overload | Use | [NBK25497](https://www.ncbi.nlm.nih.gov/books/NBK25497/) |
| YouTube Data API v3 | Video discovery | `search.list`, `videos.list` metadata | Catalog-only (`YOUTUBE_API_KEY` unread) | Official API | Free daily quota | Google Cloud project | $0 list price | $0 within quota | Official | **100 `search.list`/day**; 10,000 other units | `YOUTUBE_API_KEY` | Medium | Real video IDs/titles/channels | ToS: no scraping; `captions.download` **owner/edit permission only** | Use (search only, after approval) | [Quota](https://developers.google.com/youtube/v3/determine_quota_cost), [captions.download](https://developers.google.com/youtube/v3/docs/captions/download) |
| USPTO Open Data Portal | Patents | Search + metadata + documents | Catalog-only | Official REST | Free | USPTO.gov + MFA + **ID.me** | $0 | $0 | Official | Weekly quotas; 1 in-flight call/key | `USPTO_API_KEY` | Medium | Inventor patents | Key not shareable; profile fields required | Use after key | [data.uspto.gov/apis](https://data.uspto.gov/apis) |
| Tavily Researcher | Web search | Search | Partial (if `TAVILY_API_KEY` set) | Official | 1,000 credits/month free | Free account | $0 then $0.008/credit | $0 if within free | Official | Basic search = 1 credit | `TAVILY_API_KEY` | Small | Fallback search | Do not scrape beyond API | Optional | [tavily.com/pricing](https://www.tavily.com/pricing) |
| ABPP directory | Board certification | Manual lookup | Proposed | Public directory; no verification API found | Free lookup | No | $0 | $0 (staff time) | Unverified quote for any paid verify product | Manual | none | Medium (manual workflow) | Only authoritative cert path for ABPP-CN | Do not infer from Justia | Use (manual / future adapter) | abpp.org (verify on site) |
| CHEA / USDE databases | Accreditation | Manual | Catalog-only | Public websites | Free | No | $0 | $0 staff time | Official | Manual | none | Medium | Close accreditation gap | No inventing accreditation | Defer | chea.org / ed.gov |

**YouTube captions:** official `captions.download` “requires the user to have permission to edit the video.” Third-party caption harvest via unofficial timedtext endpoints is **rejected**.

---

## 3. Usage-based paid APIs

| Provider | Category | Capability | Status | Pricing model | Published price (22 Oct 2026) | Est. / investigation | Confidence | Secrets | Effort | Benefit | Terms | Rec. | References |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gemini 2.5 Flash + Google Search grounding | Web search | Grounded search (not a finding) | Working when `GEMINI_API_KEY` set | Usage; daily free grounding | Tokens: $0.30 / 1M in, $2.50 / 1M out. Grounding: 1,500 RPD free (Flash+Flash-Lite), then **$35 / 1,000 grounded prompts** | Typical 44 queries: **$0** if under RPD; **$1.54** if over; tokens ~$0.05–$0.20 | Official (pricing page updated 19 Oct 2026) | `GEMINI_API_KEY` | — | Current web discovery | Display grounding as required by Google; do not treat model prose as evidence | Use | [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Serper | Web search | Google results JSON | Working if key set | Prepaid credits | Starter **$50 / 50k** = $1.00 / 1k; volume to $0.30 / 1k; credits 6 months | 44 queries ≈ **$0.04** at $1/1k | Third-party recap of serper.dev (Oct 2026) | `SERPER_API_KEY` | — | Structured hits if Gemini misses | Paid product | Optional | serper.dev |
| Brave Search API | Web search | Independent index | Working if key set | Prepaid credits | **$5 / 1,000** search requests | 44 queries ≈ **$0.22** | Official | `BRAVE_SEARCH_API_KEY` | — | Non-Google fallback | Prepaid, no subscription | Optional | [brave.com/search/api](https://brave.com/search/api/) |
| Tavily overage | Web search | Search / extract | Partial | $0.008 / credit PAYG | See §2 | 44 basic ≈ **$0.35** if over free | Official | `TAVILY_API_KEY` | — | Extract | Credit model | Optional | [docs.tavily.com](https://docs.tavily.com/documentation/api-credits) |
| PACER via CourtListener recap-fetch | Federal filings | Buy docket/PDF; then CL stores text | Proposed; **not coded** | PACER per-page (API itself free) | **$0.10/page**, $3 cap/document (not transcripts); **$30/quarter auto-waiver**; 2027: $0.12 and $40 waiver | Low ~$0–$3; typical ~$5–$30; high uncapped transcripts | Official US Courts | PACER username in secret store — **not** env password in git | Large | Full motions/orders | Recap-fetch uses **client PACER credentials**; password rotation 180 days | Defer until approved | [EPA fee schedule](https://www.uscourts.gov/court-programs/fees/electronic-public-access-fee-schedule), [CL recap-fetch](https://www.courtlistener.com/help/api/rest/v4/recap/) |
| AssemblyAI Universal-3.5 Pro async | Transcript of **supplied** media | Transcribe only (does not search YouTube) | Proposed | Usage | Vendor page: **$0.21 / hour** batch; diarization extra ~$0.02/hr; ~$50 intro credits | 30 min ≈ **$0.11**; 2 hr ≈ **$0.42** | Official (AssemblyAI blog Jul 2026) | `ASSEMBLYAI_API_KEY` | Medium | Timestamped segments after authorized media | Storage/redistribution limited by media license | Optional after video discovery | [assemblyai.com/blog/speech-to-text-api-pricing](https://www.assemblyai.com/blog/speech-to-text-api-pricing) |
| Google Cloud Speech-to-Text V2 | Same | Transcribe supplied audio | Proposed | Usage | Standard ~**$0.016/min** first 500k min; dynamic batch ~$0.004/min; 60 min/month free | 30 min standard ≈ **$0.48** | Mix of official + 2026 roundups — confirm GCP price card before buy | GCP | Medium | Alternative STT | Audio must be lawfully obtained | Optional | cloud.google.com/speech-to-text/pricing |
| Deepgram Nova-3 | Same | Transcribe | Proposed | Usage | ~$0.26–$0.46/hr depending on mode | 30 min ≈ **$0.13–$0.23** | Vendor marketing; confirm console | `DEEPGRAM_API_KEY` | Medium | Fast STT | Promo rates change | Optional | deepgram.com |
| AWS Transcribe | Same | Transcribe | Proposed | Usage | ~$0.024/min tier 1 | 30 min ≈ **$0.72** | Official-range 2026 | AWS | Medium | If already on AWS | 15s minimum | Defer | aws.amazon.com/transcribe/pricing |
| Azure AI Speech | Same | Transcribe | Proposed | Usage | Batch ~$0.18/hr (roundup); real-time $1.00/hr | 30 min batch ≈ **$0.09** | Confirm Azure price card | Azure | Medium | If already on Azure | Region varies | Optional | azure.microsoft.com/pricing |
| Google Maps Platform | Location | Places | Catalog-only | Usage | Grounding Maps $25/1k after free RPD on Gemini; native Maps SKUs separate | Do not enable until needed | Official | `GOOGLE_MAPS_API_KEY` (unread today) | Medium | Office listing | ToS restrict storing places | Defer | Google Maps Platform pricing |

Transcription APIs **do not discover videos**. Discovery (YouTube Data API or web search) is a separate step. Media download/storage must be lawful.

---

## 4. Subscription or licensed legal databases

| Provider | Category | Capability | Status | Access | Price | Account | Est. / investigation | Confidence | Rec. | Notes / references |
|---|---|---|---|---|---|---|---|---|---|---|
| TrialSmith | Depositions | Full transcripts (online read on Pro); downloads extra | Catalog / request flag only (`EWI_REQUEST_TRIALSMITH_ENABLED=false`) | Member portal; **no public API found** | Subscription **quote**; downloads **$28–$50**; Pro = unlimited online read | Plaintiff-lawyer membership | Quote required (excluded from numeric totals) | Official pages 22 Oct 2026 | Defer | [trialsmith.com Deposition Pricing](https://www.trialsmith.com/?pg=DepositionPricing); license forbids building a competing database |
| LexisNexis | Legal, testimony | Docket + publications + some transcripts depending on plan | Catalog-only; adapter never sends | Subscription | Quote required | Paid org account | Quote required | — | Defer | `LEXISNEXIS_API_KEY` unread |
| Westlaw | Legal | Same class | Not in catalog | Subscription | Quote required | Paid org account | Quote required | — | Defer | No adapter |
| PACER Case Locator / CM/ECF | Federal dockets | Search + documents | Proposed via CL recap-fetch | PACER account | See §3 | PACER login (secret store) | See §3 | Official | Optional after approval | Opinions free; transcripts not $3-capped |
| Commercial criminal / NPDB aggregators | Criminal, malpractice | Varies; often stale | Catalog-only; never sent | Subscription | Quote / reject | — | — | — | **Reject** unverified background-check claims | NPDB is restricted |

---

## 5. Optional premium

| Provider | Why consider | Why wait |
|---|---|---|
| CourtListener recap-fetch + PACER | Retrieves the actual motion/order the Demery report currently cites as snippets | PACER fees; credential handling; 180-day password rotation |
| YouTube Data API search | Replaces `site:youtube.com` luck with video IDs | Needs Google Cloud project; still no third-party captions |
| USPTO ODP | Closes patents “not implemented” | ID.me identity verification for the key holder |
| AssemblyAI (or Gemini 3.5 transcribe) | Timestamped quotes after **authorized** media ingest | Useless until discovery + lawful file |
| Manual ABPP / university / FOIA workflow | Only path for true credential verification | `EWI_REQUEST_*` flags off; do not auto-send |

---

## 6. Not recommended

| Item | Reason |
|---|---|
| Unofficial YouTube transcript scrapers | Violates YouTube ToS; captions.download is owner-only |
| Paywall bypass / bot-wall defeat (MQA, Sunbiz, LinkedIn) | Prohibited by project rules and site terms |
| Cheap criminal-record APIs | Aggregators; identity error; false “no record” claims |
| Treating Gemini grounding prose as a finding | Code already treats it as a lead; Word (9) still elevated some snippets |
| Inferring ABPP from a Justia or PACER sentence | Explicitly wrong; routing fix added |
| Enabling Lexis/TrialSmith scraping | No API; license forbids competitive reuse |
| Setting reserved `.env` keys and calling the source “connected” | Keys are documented as unread |

---

## Free vs paid matrix (summary)

| Class | Providers |
|---|---|
| Free, no account | NPI, Open Payments, NIH RePORTER, Justia (when readable), GDELT/News RSS, Florida MQA/Sunbiz when not blocked |
| Free + registration / key | PubMed key, ORCID client, OpenAlex/Crossref mailto, CourtListener token, YouTube Data API quota, USPTO ODP, Tavily 1k credits |
| Usage-based | Gemini grounding (after RPD), Serper, Brave, Tavily overage, PACER pages, STT vendors |
| Subscription / quote | TrialSmith, LexisNexis, Westlaw, SEAK/DRI/ALM directories |
| Not recommended | Transcript scraping, background-check mills, paywall bypass |
