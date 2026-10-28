# EWI report source platform pricing packages

Research accessed 27 October 2026. All figures USD. Planning volume: 20 investigations/month (240/year) unless a vendor forces a higher seat minimum. Usage units per investigation follow the product’s published query budget (`WEB_SEARCH_MAX_QUERIES=64` cap, typical ~44 grounded searches) and token bands from the 22 October 2026 internal checklist, which is used **only as a name/volume checklist** — every price below was re-checked against a vendor or primary source on 27 October 2026.

Token-cost arithmetic uses a **calculated-estimate** typical band of ~52k input + ~52k output tokens per investigation (search prompts plus report wording) and a high band of ~200k input + ~300k output. Those token counts are estimates, not metered bills.

---

## Free stack residual costs (Gemini/Groq LLM tokens, embeddings, YouTube quota, AssemblyAI)

### Takeaway

At 20 investigations/month, a free-API stack still has a small recurring LLM bill if the Gemini project is on the paid Developer API, typically about **$0.15–$0.25 per investigation** ($36–$56/year) on Flash models, plus negligible embeddings. YouTube Data API and USPTO ODP have **$0 list price**. AssemblyAI is **$0.21/hour** with **$50 signup credits**, which at this volume is effectively free unless transcription is turned on often. Groq is cheaper than Gemini for wording only, but it cannot replace Google Search grounding.

### Cited Findings

- Gemini Developer API pricing page, last updated **2026-10-27 UTC**, paid Standard `gemini-2.5-flash`: **$0.30 / 1M input** (text/image/video), **$2.50 / 1M output** including thinking tokens. Free tier tokens are “Free of charge” but “Used to improve our products = Yes.” Google AI Studio usage is free of charge in available regions. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Same page, paid Standard `gemini-3.8-flash`: **$0.75 / 1M input** and **$3.75 / 1M output** through **31 December 2026**, then **$1.50 / $7.50** starting 1 January 2027. Free-tier tokens remain free of charge. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Same page, paid Standard `gemini-3.5-flash-lite`: **$0.30 / 1M input**, **$2.50 / 1M output** (same dollar rates as 2.5 Flash). `gemini-3.1-flash-lite`: **$0.25 / 1M input**, **$1.50 / 1M output**. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Grounding with Google Search, **Gemini 2.5 Flash/Flash-Lite paid**: **1,500 grounded prompts per day free** (shared Flash + Flash-Lite), then **$35 / 1,000 grounded prompts**. Free-tier grounding: **500 RPD** shared. A tools summary on the same page restates this split vs Gemini 3. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Grounding with Google Search, **Gemini 3 and newer paid**: **5,000 free search requests per month** shared across all Gemini 3+ models, then **$14 / 1,000 requests**. Footnote: one customer-submitted request “may result in one or more queries to Google Search” and each individual search query is charged. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- File search embeddings on the same page: **$0.15 / 1M tokens**. Gemini Embedding 2 (`gemini-embedding-2`) paid Standard **text input $0.20 / 1M tokens**; output embeddings are not separately priced on this card. Free-tier embedding text is free of charge. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Older Gemini Embedding GA post (14 July 2025) priced `gemini-embedding-001` at **$0.15 / 1M input tokens**. That model is not the headline embedding SKU on the 27 October 2026 Developer API pricing page. — [Google Developers Blog](https://developers.googleblog.com/en/gemini-embedding-available-gemini-api/)
- Groq production catalog (docs, accessed 27 Oct 2026): **GPT-OSS 20B $0.075 input / $0.30 output per 1M tokens**; **GPT-OSS 120B $0.15 / $0.60**; Llama 3.1 8B Instant and Llama 3.3 70B Versatile are **Contact Sales** (Enterprise only). Whisper Large V3 **$0.111/hour**; Whisper Large V3 Turbo **$0.04/hour**. Developer plan is pay-per-token. — [Groq Supported Models](https://console.groq.com/docs/models); [Groq billing plans](https://console.groq.com/settings/billing/plans)
- YouTube Data API v3 default project quota: **100 `search.list` calls/day** (own bucket, 1 unit each), **100 `videos.insert`/day**, and **10,000 units/day** for all other methods. Daily reset midnight Pacific. Extra quota is an audit/extension process, **not a published overage SKU**. — [YouTube quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost); [Quota and compliance audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- AssemblyAI pricing page (vendor “last updated 2026-09-28”): Universal-3.5 Pro async **$0.21/hour**; Universal-2 **$0.15/hour**; standard async diarization **+$0.02/hour**; Medical Mode **+$0.15/hour**; **$50 free credits** at signup, no card required. — [AssemblyAI pricing](https://www.assemblyai.com/pricing)
- USPTO Open Data Portal: site access needs a free USPTO.gov account + MFA; **API key requires a one-time ID.me identity link**. Bulk/UI access is free; APIs are free with the key. Profile fields were required by 8 October 2026 or keys were deactivated. — [USPTO ODP registration](https://data.uspto.gov/support/universal-registration); [USPTO ODP FAQ](https://data.uspto.gov/support/faq)
- PACER: **no registration fee**. Case-search accounts activate with a card, or by mailed token in 7–10 days without a card. — [PACER User Manual 2026 (September)](https://pacer.uscourts.gov/sites/default/files/files/PACER%20User%20Manual%202026_Updated%20September.pdf); [PACER fee-waiver options](https://pacer.uscourts.gov/my-account-billing/billing/options-access-records-if-you-cannot-afford-pacer-fees)

### Inferences

- **Typical paid-Gemini 2.5 Flash token cost per investigation** ≈ 0.052 × $0.30 + 0.052 × $2.50 = **$0.15**. Monthly ≈ **$3.00**. Annual ≈ **$36**. High band ≈ **$0.81/investigation**, **~$194/year**. These are calculated estimates, not invoices.
- **Typical paid Gemini 3.8 Flash** (promo rates through 31 Dec 2026) ≈ 0.052 × $0.75 + 0.052 × $3.75 = **$0.23/investigation**, **~$56/year**. After 1 Jan 2027 those token rates double.
- **Groq GPT-OSS 20B** on the same token band ≈ **$0.02/investigation**, **~$5/year**. Useful only as a wording/fallback LLM. It does not search the web.
- **Embeddings** at ~50k tokens/investigation on Gemini Embedding 2: 0.05 × $0.20 = **$0.01**, **~$2.40/year**. File-search embedding rate $0.15/1M is in the same negligible band.
- **Gemini 2.5 Flash grounding at 20 investigations/month is $0** if jobs are spread or even batched: 20 × 44 = 880 grounded prompts; 20 × 64 = 1,280. Both sit under the **1,500 RPD** paid free allotment *unless* many runs land on one UTC day *and* each “prompt” is billed 1:1. Gemini 3’s 5,000 **monthly search queries** is tighter if each prompt fans out to multiple Search queries (880 prompts × 6 queries = 5,280, which would start paying $14/1k). At a 2–3 queries/prompt fan-out, 20 × 44 still stays inside 5,000.
- **YouTube**: 20 investigations × 5–15 `search.list` calls = 100–300 calls. The **100/day** cap is the constraint, not money. A single busy day of 20 investigations can exhaust quota; extra quota is not sold at a list price.
- **AssemblyAI**: 30 minutes = **$0.105**. The $50 credit equals ~238 hours of Universal-3.5 Pro — years of EWI volume. Recurring STT is not a planning cost unless transcription is on by default. YouTube watch URLs are not valid AssemblyAI `audio_url` inputs (known product constraint; not re-priced here).
- **Package A residual recurring (production paid Gemini 2.5 Flash, no STT, under grounding quota): ~$36–$56/year, ~$0.15–$0.25 per investigation.** One-time setup: $0 (YouTube key, USPTO ID.me, CourtListener token, NCBI key, PACER registration).

### Gaps

- Live AI Studio vs Cloud billed-project distinction for this repo was not inspected; Google’s page says Studio is free and paid API is billed. Confirm which project the production `GEMINI_API_KEY` hits before promising $0 tokens.
- No public per-investigation token telemetry was re-metered on 27 October 2026; 52k/52k is an estimate carried from the volume checklist.
- Groq’s marketing pricing page (`home.cloud.groq.io/pricing`) still showed self-serve Llama rates that Groq’s own docs mark Enterprise-only. **Docs catalog is treated as authoritative**; the marketing page is contradictory.
- `gemini-embedding-001` vs `gemini-embedding-2`: current Developer API pricing page lists Embedding 2, not 001. If the product still calls 001, confirm the live SKU in AI Studio.

---

## Search APIs: Serper vs Brave vs Tavily vs Gemini grounding at EWI volumes

### Takeaway

At 880–1,280 searches/month, **Gemini 3 grounding, Brave’s $5 monthly free credits, and Tavily’s 1,000 free credits can each cover typical volume at $0.** Serper is the cheapest *Google SERP* API at **$1.00 / 1,000** on the starter pack, but **6-month credit expiry** forces about **$100/year** if you buy two $50 packs even though you will use only ~10k queries. Do not stack all four. The 22 October internal note of Gemini grounding at **$35/1,000 after 1,500 RPD** is still correct **for 2.5 Flash**; Gemini 3+ is a different meter (**$14/1,000 after 5,000/month**).

### Cited Findings

- Brave Search API public page (accessed 27 Oct 2026): Search plan (Web, LLM Context, Images, News, Videos, Places) **$5 per 1,000 requests**, prepaid credits, no subscription, 50 qps. Answers plan **$4 / 1,000 requests + $5 / 1M tokens**. — [Brave Search API](https://brave.com/search/api/)
- Brave (12 Feb 2026 post, updated 25 Jun 2026): every plan includes **$5 free credit each month** (1,000 Search requests). Attribution required to use the free credit. — [Brave blog](https://brave.com/blog/most-powerful-search-api-for-ai/); dashboard FAQ [Help & Feedback](https://api-dashboard.search.brave.com/documentation/resources/help-feedback)
- Tavily pricing (accessed 27 Oct 2026): Researcher **1,000 API credits/month free**, no card; Pay as you go **$0.008/credit**; Project **$30/month for 4,000 credits**. Credits reset on the 1st of each month. — [Tavily pricing](https://www.tavily.com/pricing)
- Tavily credit table (docs): Project $30 / 4,000 = **$0.0075/credit**; Bootstrap $100 / 15,000; Startup $220 / 38,000; Growth $500 / 100,000. Basic search = **1 credit**; advanced search = **2 credits**; basic extract = 1 credit per 5 URLs. — [Tavily API credits](https://docs.tavily.com/documentation/api-credits)
- Serper homepage (accessed 27 Oct 2026) is JavaScript-heavy; fetch did not yield a clean pack table. Indexed homepage/FAQ text on serper.dev states **credits valid 6 months**, a pack at **$375 for 500,000 queries**, and a pack for **12,500,000 queries**, prices excluding tax/VAT/GST, 2,500 free queries in third-party recaps. Independent recaps that say they copied serper.dev on **6 Oct 2026**, **15 Oct 2026**, and **21 Oct 2026** all list: Free 2,500; Starter **$50 / 50,000 ($1.00/1k)**; Standard **$375 / 500,000 ($0.75/1k)**; Scale **$1,250 / 2,500,000 ($0.50/1k)**; Ultimate **$3,750 / 12,500,000 ($0.30/1k)**; 6-month expiry. — [serper.dev](https://serper.dev/); [apiserpent recap 6 Oct 2026](https://apiserpent.com/blog/serper-pricing-credits-explained); [keirolabs recap 15 Oct 2026](https://keirolabs.cloud/blog/serper-api-guide-2026); [PrismCrawl comparison 21 Oct 2026](https://www.prismcrawl.com/blog/cheapest-serp-api)
- Gemini 2.5 vs 3 grounding rates as cited in the previous section. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)

**Monthly arithmetic at 20 investigations (calculated estimate):**

| Provider | Typical 880 queries | High 1,280 queries | Notes | Figure type |
|---|---|---|---|---|
| Gemini 3+ grounding | $0 (under 5,000/mo if fan-out is modest) | $0, or starts paying if fan-out × prompts > 5,000 | Then $14/1k search queries | Public list + estimate of fan-out |
| Gemini 2.5 Flash grounding | $0 (under 1,500 RPD) | $0 unless one-day burst of 1,500+ prompts | Then $35/1k grounded prompts | Public list |
| Brave Search | $0 (≤ 1,000 free credits) | $1.40 overage (280 × $0.005) | Need a card even to claim $0 spend | Public list |
| Tavily basic | $0 (≤ 1,000 free) | $2.24 PAYG or bump to $30 Project | Advanced search doubles credits | Public list |
| Serper starter rate | $0.88 usage but **$50 pack / 6 months** | $1.28 usage, same pack | Expiry dominates | Pack table third-party recap of vendor homepage |

### Inferences

- **Do not buy a search API to “enable” EWI at 20/month if Gemini grounding is already on a paid project.** Grounding is inside the free bucket at this volume for both 2.5 (daily) and 3.x (monthly), with the caveat that Gemini 3 bills *search queries* not prompts.
- If Gemini snippets are weak and a **structured Google SERP** is required: Serper Starter is $50 every 6 months (**$100/year**, **$0.42/investigation** amortized) even though usage is ~$11 of credits. That is an expiry tax, not a usage tax.
- If a **non-Google fallback** is required: Brave is the better fit at this volume because **1,000 free Search requests/month ≈ typical EWI load**. High month ≈ **$1.40**.
- Tavily Project at $30/month (**$360/year**, **$1.50/investigation**) is not justified at 880–1,280 basic searches; the free 1,000 credits already cover typical. Use Tavily only if extract/crawl is the actual need.
- Running Serper + Brave + Tavily + Gemini on every query would add ~$0.26–$0.60 per investigation of duplicate search with no new evidence class. Pick **one primary (Gemini grounding) and at most one structured fallback (Brave free credits, or Serper if Google SERP JSON is required).**

### Gaps

- Serper’s exact on-page pack table could not be parsed from the 27 Oct 2026 HTML fetch. Treat the $50/$375/$1,250/$3,750 ladder as **third-party recap of a public homepage**, consistent across three October 2026 writeups, not as a screenshot of today’s DOM.
- Gemini 3 fan-out (search queries per grounded prompt) is not published as a fixed multiplier. Whether 20 × 64 prompts stays under 5,000 search queries is an operational measurement, not a list fact.
- Brave free-credit attribution requirement (“attribute the Brave Search API in your project’s website / about pages”) was not checked against EWI client-report branding rules.

---

## CourtListener token vs PACER vs UniCourt vs TrialSmith vs Lexis vs Westlaw

### Takeaway

CourtListener’s API **token is free**; you pay with **rate limits** (125 requests/day on the free tier) and, if the product is revenue-positive, a **commercial agreement (quote)**, because membership API access is barred for commercial products. PACER is **$0 to register**, **$0.10/page** with a **$3/document cap** (30 pages) and a **$30/quarter automatic waiver** through 2026; on **1 January 2027** that becomes **$0.12/page** and a **$40/quarter waiver**. UniCourt has a public human-UI ladder starting at **$59 / $199 / $399 per month**; the **Enterprise API is custom**. TrialSmith Pro is advertised as a **$749 value** for a 12-month membership, with transcript downloads **$28–$50**, plaintiff-lawyer only, **no public API**. Lexis and Westlaw now publish **small-firm self-serve seats** in the **~$114–$432/month (Lexis)** and **~$155–$400/month (Westlaw)** bands; both remain the wrong first purchase for expert-file completeness.

### Cited Findings

**CourtListener / Free Law Project**

- REST API v4: token authentication is free with a CourtListener account; default authenticated limits **5/minute, 50/hour, 125/day**. Membership expands limits; commercial agreements available. Multiple accounts per org are forbidden. — [CourtListener REST API](https://www.courtlistener.com/help/api/rest/)
- Individual membership list: Free non-member API 5/50/125; Tier 1 **$10/mo or $100/yr** (10/75/300); Tier 2 **$25/mo or $250/yr** (15/150/600); Tier 3 **$50/mo or $500/yr** (20/250/1,000); Tier 4 **$100/mo or $1,000/yr** (25/300/1,400). Group 1–5 users: **$30 / $75 / $150 / $300 per month** by tier. — [Free Law Project membership](https://free.law/membership/)
- Membership API access **may not be used to power a revenue-positive commercial product**. Solo and firms of **five or fewer attorneys** are in the allowed class; larger or funded orgs should buy a commercial agreement. — [Membership-based API usage restrictions](https://free.law/membership/allowed-api-usage/)

**PACER**

- Current EPA fee schedule (effective 1 Jan 2020, still posted 27 Oct 2026): **$0.10 per page**, not to exceed the fee for thirty pages, for case documents/docket sheets/case-specific reports; transcripts and non-case-specific reports (Case Locator, docket activity) are **$0.10/page with no $3 cap**; audio **$2.40/file**; opinions **free**; automatic exemption until an account accrues **more than $30.00 in a quarterly billing cycle**. — [Electronic Public Access Fee Schedule](https://www.uscourts.gov/court-programs/fees/electronic-public-access-fee-schedule)
- PACER Service Center: **no registration fee**. — [PACER User Manual 2026](https://pacer.uscourts.gov/sites/default/files/files/PACER%20User%20Manual%202026_Updated%20September.pdf)
- Announced **1 January 2027** (five-year temporary): **$0.12/page** and automatic exemption raised from **$30 to $40/quarter**. First PACER fee change in nearly 15 years. — [PACER announcement 26 Jun 2026](https://pacer.uscourts.gov/announcements/2026/06/26/temporary-fee-increase-effective-jan-1-2027); [uscourts.gov news](https://www.uscourts.gov/data-news/judiciary-news/2026/06/26/judiciary-approves-funding-case-management-and-public-access-modernization)
- CourtListener recap-fetch is an API to *buy* PACER documents on the client’s PACER bill; the CL call is not a free PACER substitute. — [CourtListener REST API](https://www.courtlistener.com/help/api/rest/) (PACER Data / RECAP sections)

**UniCourt**

- Public self-serve (search-indexed 27 Oct 2026; direct fetch returned HTTP 405): Personal **$59/month** (10 searches, 1 user); Professional **$199/month** (50 searches, 2 users) — billed as “Ideal for Small Law Firms”; Premium **$399/month** (200 searches, 5 users); Enterprise **Custom**. Annual: **$590 / $1,990 / $3,990**. Court document downloads: “Fees May Apply.” Month-to-month, no free trial. API access requires an Enterprise plan via sales; billable API calls include Search, Case, Download Document, Order Document Confirm, Update Cases. — [UniCourt pricing](https://unicourt.com/pricing)
- Capterra/GetApp (updated Sep 2026) list UniCourt **Enterprise API starting at $2,250 per user per month**. That is a **directory listing, not UniCourt’s own quote**. — [Capterra](https://www.capterra.com/p/232162/UniCourt/); [GetApp](https://www.getapp.com/legal-law-software/a/unicourt/)

**TrialSmith**

- Deposition pricing page (accessed 27 Oct 2026): Pro-Plan members **read transcripts online at no extra fee**; downloads **$28 to $50** depending on acquisition cost; à-la-carte purchase or membership; **up to $30 credit** per contributed new expert transcript. Plaintiff-only network. — [TrialSmith Deposition Pricing](https://www.trialsmith.com/?pg=DepositionPricing)
- Contributor offer pages value a **12-month Pro Plan at $749** (and a 6-month Pro at the same $749 “value”). Membership application shows plans only after choosing a trial-lawyer association. No public API. Terms: subscription fee + content fees; fees change without notice on new orders. — [12-month contributor offer](https://www.trialsmith.com/?pg=Free-Trial--for-Contributors); [join](https://www.trialsmith.com/?pg=joinTrialsmith); [Terms](https://www.trialsmith.com/?pg=TermsAndConditions)

**LexisNexis**

- Direct fetch of [store.lexisnexis.com/lawfirms](https://store.lexisnexis.com/lawfirms) and the Small Law schedule URL returned **403** on 27 Oct 2026.
- Secondary sources that cite the live store for **1–3 attorney new-customer** Lexis+ (re-checked by those writers Aug–Sep 2026): Essential **$114/mo (3-year) / $152/mo (1-year)**; Deluxe Transactional **$217 / $289**; Enhanced **$257 / $342**; Professional **$324 / $432**. Firms of 4+ attorneys are quote-only. Spellbook and CaseSearch.ai both attribute these to the Lexis store. — [Spellbook LexisNexis pricing 2026](https://spellbook.com/learn/lexisnexis-pricing); [CaseSearch.ai](https://casesearch.ai/blog/lexisnexis-subscription)
- A Lexis “Small Law Price Schedule” effective **2 October 2026** exists (search snippet): transactional extras include system access **$60**, primary-law document access **$24**, premium litigation briefs/expert-witness analysis **$100**, verdict analyzer reports **$99–$250**. Administration charge for 1–5 attorney firms appears in secondary writeups as **$25/month** but the 403 blocked confirmation of that line. — [Lexis Small Law schedule URL](https://www.lexisnexis.com/en-us/terms/SALegal/pricing.page) (blocked); [Spellbook](https://spellbook.com/learn/lexisnexis-pricing)

**Westlaw / Thomson Reuters**

- Official Westlaw Advantage FAQ (accessed 27 Oct 2026): **$256.75/month** single-circuit, **$399.75/month** all states + federal; **12% off** 2-year, **18% off** 3-year; online pricing for **new customers, firms up to 10 attorneys**; existing customers must call. — [Westlaw Advantage plans & pricing](https://sales.legalsolutions.thomsonreuters.com/en-us/products/westlaw-advantage/plans-pricing)
- Secondary sources citing Thomson Reuters self-serve pages (June 2026): Westlaw Edge with AI-Assisted Research **$155.35/month** single circuit and **$266.50/month** all states + federal on a **3-year term**. Westlaw Classic ~$133 / $200 / $266.40 from a Dec 2024 Lawyerist cite (older). Precision/CoCounsel still quote-only. — [vaquill.ai Westlaw 2026](https://www.vaquill.ai/blog/how-much-does-westlaw-cost-solo-small-firm-pricing)

**Annual / per-investigation at 20/month, 1 seat unless noted (mix of list and estimate):**

| Source | Recurring list or best public figure | Annual | Per investigation (÷240) | Type |
|---|---|---|---|---|
| CourtListener token | $0 | $0 | $0 | Public list (rate-limited) |
| FLP individual Tier 2 | $25/mo | $250 | $1.04 | Public list; **not for commercial product** |
| FLP group 1–5 Tier 1 | $30/mo | $360 | $1.50 | Public list; same restriction |
| PACER registration | $0 | $0 | $0 | Public list |
| PACER usage | $0.10/page, $30/qtr waived | $0 if ≤$120/year usage; else usage − $120 | Highly variable | Public list + estimate |
| PACER from 1 Jan 2027 | $0.12/page, $40/qtr waived | same shape | same | Announced official |
| UniCourt Professional | $199/mo (50 searches, 2 users) | $2,388 ($1,990 annual prepay) | $9.95 ($8.29 annual) | Public list (UI, not API) |
| UniCourt Enterprise API | Custom; directory $2,250/user/mo | quote | quote | Quote / third-party directory |
| TrialSmith Pro | $749 “12-month value” | ~$749 if that is the real invoice | ~$3.12 + $28–$50 per download | Vendor “value” not a checkout price |
| Lexis Essential 1-yr | $152/mo | $1,824 | $7.60 | Secondary recap of store (403 today) |
| Lexis Professional 1-yr | $432/mo | $5,184 | $21.60 | Secondary recap of store |
| Westlaw Edge AI 3-yr all-states | $266.50/mo | $3,198 | $13.33 | Secondary citing TR; Advantage all-states **$399.75/mo = $4,797** is official FAQ |

### Inferences

- **CourtListener is the correct free legal API.** The token is free. The planning risk is **125 requests/day**: if 20 investigations each make 20 CL calls on the same day, that is 400 calls and the free tier dies mid-batch. Spreading jobs, or a commercial FLP contract, is the real cost. Do not put a revenue-positive EWI product on a $10–$100 membership key.
- **PACER is the correct paid federal-document path.** One-time cost is $0. Recurring cost is $0 until the firm crosses $30/quarter (~300 pages or ~10 capped PDFs). Expert investigations that pull *many* motions will blow the waiver; transcripts are **not** $3-capped. Budget PACER as **$0 (waiver)** vs **$5–$30 typical when used** vs **uncapped transcripts**.
- **UniCourt Professional at $199/month is a human docket UI**, not an EWI adapter. Fifty searches/month is tight for 20 investigations if each needs name + alias + related-case queries (40–60 searches). Premium $399 is the first UI plan that is comfortable. The Enterprise API starting-price rumor ($2,250/user/month) would be **$27,000/year per user** — reject unless UniCourt sends a real quote that is an order of magnitude lower.
- **TrialSmith is the deposition gap-filler and it is human-operated.** $749/year amortized is cheap **if** the firm qualifies as plaintiff counsel and can live with a portal (no API). Downloads at $28–$50 are only for files that must be retained. License forbids building a competing database — so EWI must request/cite, not scrape.
- **Lexis/Westlaw small-firm seats are now publicly priced, but they are research platforms, not expert-investigation APIs.** A $3k–$5k/year seat buys caselaw, citators, and some briefs/verdicts. It does **not** replace FSMB, Open Payments, or TrialSmith. Buy one seat in Package C only if the client already expects a Lexis/Westlaw-grade opposing-expert appendix (CourtLink, jury verdicts, expert-witness analysis documents). Do not buy both.

### Gaps

- UniCourt.com/pricing fetch returned **405**; prices above are from search-indexed page content. Re-open in a browser to screenshot before a client email.
- Lexis store and Small Law schedule were **403**. Treat $114–$432/month as **secondary recap of a public store**, not a 27 Oct 2026 first-party capture. Get a quote for a PI firm (jurisdiction SKUs change the number).
- TrialSmith **actual** Pro invoice (vs $749 “value”) is behind the association picker. Confirm with sales; it may be monthly, annual, or association-discounted.
- Free Law Project **commercial API** list price: none published.
- PACER $3 cap math ($0.10 × 30 pages) is inferred from the fee schedule’s “not to exceed the fee for thirty pages”; the 2027 $0.12 rate would imply a **$3.60** cap if the 30-page rule is unchanged — **not confirmed in the June 2026 announcement**.

---

## FSMB/DocInfo, ABMS, SEAK, DRI

### Takeaway

**FSMB Physician Data Center Premium at $12 per physician** is the only cheap, official, per-investigation product that simultaneously closes **multi-state licenses, board discipline, and ABMS specialty**. DocInfo.org is the **free consumer** front end of the same data (manual, no API). ABMS CertiFACTS / Direct Connect are **quote-only**. SEAK’s **$655** is an **expert listing fee**, not a research subscription — the attorney directory search is free. DRI individual dues are **$335/year** and include an expert-witness database, but DRI is a **defense** bar; a PI (plaintiff) product may be ineligible.

### Cited Findings

- FSMB PDC FAQ (accessed 27 Oct 2026): **Standard Profile $9.00/physician** including 12 months of monitoring; **Premium Profile $12.00/physician** = Standard plus **ABMS board specialty**. Charged per query; monthly invoice on the 1st. MD/DO/PA only. No malpractice data in the profile. Account setup via PDC registration. Unlimited users on one org account. — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq)
- DocInfo is FSMB’s **free consumer** physician/PA search (name + state) drawing on the same Physician Data Center, including discipline flag, active licenses, school, location, and specialty from ABMS/AOA, with links out to the state board for sanction details. 2015 relaunch described it as free. Zendesk how-to has no fee step. — [FSMB 2015 DocInfo relaunch PDF](https://www.fsmb.org/siteassets/advocacy/news-releases/2015/news-release-docinfo-relaunch.pdf); [DocInfo search help](https://docinfo.zendesk.com/hc/en-us/articles/28080178033428-How-do-I-search-for-a-doctor)
- A 2001 LA Times article described an earlier DocInfo **$9.95** consumer fee. That is **historical**, contradicted by the 2015 free relaunch and current how-to. — [LA Times 16 Apr 2001](https://www.latimes.com/archives/la-xpm-2001-apr-16-he-51564-story.html)
- ABMS Solutions: CertiFACTS Online = 1- and 2-year **unlimited-search subscriptions** (price not listed). Direct Connect Select = pay-per-search **minimum 100 queries** or unlimited, API through credentialing vendors (Axuall, HealthStream, MD Staff, symplr, Verifiable). Contact **sales@ABMSSolutions.com / 800-733-2267**. CertificationMatters consumer search is not licensed for NCQA/TJC commercial verification. — [ABMS product comparison](https://www.abmssolutions.com/product-solutions/product-comparison/); [Direct Connect Select](https://www.abmssolutions.com/product-comparison/abms-direct-connect-select/); [Certification Matters FAQ](https://www.certificationmatters.org/faq/how-can-i-verify-a-doctors-board-certification-for-professional-use/)
- SEAK Expert Witness Directory **annual Standard Listing $655** (online + print); extra state **$350/state/year**; half-page print ad $770, full page $1,270. This is what **experts pay to be listed**. The 2026 print directory states it is **free to search**. SEAK books (fee survey, etc.) are **$150**. — [seakexperts.com signup](https://www.seakexperts.com/signup); [store listing](https://store.seak.com/seak-expert-witness-directory-listing/); [2026 directory PDF](https://seak.com/expertdirectory_2026/Expert_Directory_2026_1_web.pdf)
- DRI 2026 individual application (filename IM-2026): Defense Attorney / In-House Counsel **$335/year**; Young Lawyer **$195/year**. Senior $65, student $20, affiliate $125. Corporate membership **$500/year for up to four employees**, additional **$150** each, and includes “Access to the DRI Expert Witness Database, with information on more than 65,000 plaintiff and defense experts.” — [DRI individual application PDF](https://www.dri.org/docs/default-source/membership-applications/individual.pdf?sfvrsn=496220f1_26); [DRI membership types](https://www.dri.org/membership/applications); [DRI corporate flyer](https://www.dri.org/docs/default-source/membership-applications/corporate-membership-flyer.pdf?sfvrsn=a9d131f1_11)

**At 20 investigations/month:**

| Item | Monthly | Annual | Per investigation | Type |
|---|---|---|---|---|
| FSMB PDC Standard | $180 | $2,160 | $9 | Public list |
| FSMB PDC Premium (includes ABMS specialty) | $240 | $2,880 | $12 | Public list |
| DocInfo.org | $0 | $0 | $0 staff time | Public free consumer |
| ABMS CertiFACTS / Direct Connect | quote (min 100 queries if pay-per-search) | quote | quote | Quote-only |
| SEAK listing | n/a | $655 | n/a — **wrong SKU** | Public list, expert-side |
| SEAK directory search | $0 | $0 | $0 | Public free |
| DRI individual | $27.92 | $335 | $1.40 | Public list; eligibility issue |

### Inferences

- **Buy PDC Premium, not a separate ABMS seat**, unless the client requires NCQA/TJC primary-source *dates* that the $12 profile does not satisfy. $12 × 240 = **$2,880/year** is the entire “licenses + discipline + board cert” line for Package B.
- **Do not buy DocInfo.** It is free and manual. It is also not an API. Use it as a staff fallback when PDC is not yet provisioned, or for psychologists/other non-MD experts who are **out of PDC scope** (PDC is MD/DO/PA only — neuropsychologists who are PhD-only will not hit).
- **Do not buy a SEAK listing.** Search SEAKexperts.com for free. A $655 listing would advertise *your* experts, which is the opposite of an opposing-expert investigation.
- **DRI $335** is inexpensive as a human expert-database seat **if the buyer is defense counsel**. For a PI law-tech product serving plaintiff firms, assume ineligibility until DRI says otherwise. Even then it is a portal, not an API.

### Gaps

- Whether FSMB licenses PDC to a **software vendor** (vs a hospital credentialer or law firm) is not stated on the FAQ. Confirm permitted use before wiring an adapter.
- PDC does not cover PhD psychologists, dentists, NPs, etc. ABPP and state psychology boards remain a manual/free-lookup gap; no price found for an ABPP verification API.
- ABMS Direct Connect’s **price per query above the 100 minimum** is unpublished.
- DRI Expert Witness Database: no à-la-carte price; bundled in dues. No API found.

---

## Cheapest combination that would make reports substantially more complete (licenses, discipline, depositions, publications, payments) — Packages A / B / C

### Takeaway

**Publications and manufacturer payments are already free** (OpenAlex, PubMed, NIH RePORTER, CMS Open Payments, NPI). The cheapest paid stack that actually closes the remaining holes is **FSMB PDC Premium ($12/expert) + PACER (often $0 under the quarterly waiver, else $0.10/page) + TrialSmith Pro (~$749/year, human portal) + keep Gemini grounding**. That is Package B, about **$4.1k–$4.9k/year** and **~$17–$20 per investigation** at 20/month. Package A stays near **$40–$60/year**. Package C (Lexis or Westlaw seat + UniCourt UI + optional DRI + PACER overage) lands around **$14k/year numeric plus quotes**, **~$60/investigation**, and is only justified when the client wants a human-operated “opposing expert file” indistinguishable from a paralegal’s Lexis/TrialSmith workup.

### Cited Findings

Coverage vs cost uses the vendor prices already cited above, plus the free sources named on the 22 October 2026 provider register (re-verified as still-free public systems, not re-priced): NPI Registry, CMS Open Payments, OpenAlex, PubMed/NCBI, NIH RePORTER, ORCID public API, Crossref, CourtListener REST, Justia HTML, Florida MQA, Google News RSS/GDELT. — [NPI](https://npiregistry.cms.hhs.gov/); [Open Payments](https://openpaymentsdata.cms.gov/); [OpenAlex](https://docs.openalex.org/); [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25497/); [NIH RePORTER](https://api.reporter.nih.gov/); [CourtListener REST](https://www.courtlistener.com/help/api/rest/)

**One-time setup (all packages):**

| Item | Cost | Type | Source |
|---|---|---|---|
| PACER Case Search account | $0 | Public list | [PACER manual](https://pacer.uscourts.gov/sites/default/files/files/PACER%20User%20Manual%202026_Updated%20September.pdf) |
| USPTO.gov + MFA + ID.me for ODP API key | $0 (identity verification, not a fee) | Public list | [USPTO ODP registration](https://data.uspto.gov/support/universal-registration) |
| YouTube Data API key on a Google Cloud project | $0 list; quota not sold | Public list | [YouTube quota](https://developers.google.com/youtube/v3/determine_quota_cost) |
| CourtListener account + API token | $0 | Public list | [CL REST](https://www.courtlistener.com/help/api/rest/) |
| NCBI / ORCID / OpenAlex polite keys | $0 | Public list | vendor docs above |
| FSMB PDC org account | $0 to open; billed per query | Public list | [PDC FAQ](https://www.fsmb.org/PDC/pdc-faq) |
| AssemblyAI signup | $0 + $50 usage credit | Public list | [AssemblyAI pricing](https://www.assemblyai.com/pricing) |

**Package A — keep free APIs only**

| Line | Monthly | Annual | /investigation | Type |
|---|---|---|---|---|
| NPI, Open Payments, OpenAlex, PubMed, NIH, ORCID, Crossref, CourtListener, Justia, FL MQA, News RSS | $0 | $0 | $0 | Public free |
| Gemini 2.5 Flash tokens (paid project, typical) | ~$3 | ~$36 | ~$0.15 | Calculated from [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5/3 grounding | $0 at this volume | $0 | $0 | Public list + volume estimate |
| Embeddings | ~$0.20 | ~$2 | ~$0.01 | Calculated from Embedding 2 $0.20/1M |
| YouTube search.list | $0 | $0 | $0 | Public quota, not sold |
| USPTO ODP | $0 | $0 | $0 | Public free after ID.me |
| Tavily/Brave free credits (optional, do not stack) | $0 | $0 | $0 | Public free buckets |
| AssemblyAI (off / unused) | $0 | $0 | $0 | — |
| **Package A typical total** | **~$3–5** | **~$40–60** | **~$0.17–$0.25** | Residual LLM |
| Package A high LLM (500k-token investigations) | ~$16 | ~$194 | ~$0.81 | Calculated |

What A still does **not** close: multi-state medical **licenses/discipline** as primary source, **ABMS/ABPP** certification, **deposition transcripts**, **PACER full text**, video **captions**, other-state boards when MQA-class sites 403.

**Package B — recommended paid stack that actually fills report gaps**

| Line | Why | Monthly | Annual | /investigation | Type |
|---|---|---|---|---|---|
| Package A free APIs + Gemini | Keep | ~$4 | ~$50 | ~$0.21 | See A |
| **FSMB PDC Premium** | Licenses + discipline + ABMS specialty | $240 | $2,880 | $12.00 | Public list |
| **PACER** (selective federal PDFs) | Full motions/orders | $0–$100 | $0–$1,200 | $0–$5 typical; $0 if under waiver | List + estimate |
| **TrialSmith Pro portal** | Depositions (human read) | ~$62 | ~$749 | ~$3.12 + $0 if online-read | Vendor “value” |
| YouTube API + USPTO ODP | Video IDs + patents | $0 | $0 | $0 | Free after setup |
| Brave **or** Tavily free tier as Gemini fallback (pick one) | Structured search if grounding misses | $0 | $0 | $0 | Public free credits |
| AssemblyAI, on-demand 30 min | Public media only | ~$0–$2 | ~$0–$25 | $0.11 per 30 min | Public list |
| Serper / Lexis / Westlaw / UniCourt / DRI / SEAK listing | — | **omit** | **omit** | — | See “do not buy” |
| **Package B numeric typical** (PACER under waiver, no STT) | | **~$306** | **~$3,680** | **~$15.30** | Mix |
| **Package B recommended planning** (PACER $50/mo overage + TrialSmith $749) | | **~$356** | **~$4,280** | **~$17.80** | Mix |
| Package B high (PACER $100/mo + some TS downloads $40×4) | | **~$422** | **~$5,060** | **~$21.10** | Mix |

Cheapest combo mapped to the four named gaps:

| Gap | Cheapest closer | Annual at 20/mo | API? |
|---|---|---|---|
| Licenses + discipline | FSMB PDC Standard $9; **Premium $12 if you also need ABMS** | $2,160 / **$2,880** | Web portal (API not confirmed public) |
| Board certification | **Included in PDC Premium**; else ABMS quote | $0 extra | Quote if standalone |
| Depositions | TrialSmith Pro ~$749/yr online-read | ~$749 | **No** — human |
| Publications | OpenAlex + PubMed + NIH (already on) | $0 | Yes |
| Payments | CMS Open Payments (already on) | $0 | Yes |
| Federal filings full text | PACER $0.10/page after $30/qtr free | $0–$1,200 | Via CL recap-fetch (not coded) or human PACER |
| Patents | USPTO ODP after ID.me | $0 | Yes |
| Videos | YouTube Data API quota | $0 | Yes (metadata only) |

**Package C — full “client-grade opposing expert file” (human legal DBs where no API exists)**

| Line | Monthly | Annual | /investigation | Type |
|---|---|---|---|---|
| Package B planning | ~$356 | ~$4,280 | ~$17.80 | Mix |
| **Lexis+ Professional 1-yr 1 seat** (verdicts, CourtLink, 50-state, expert analysis) **or** Westlaw Advantage all-states **$399.75** — pick **one** | $432 or $399.75 | $5,184 or $4,797 | $21.60 or $19.99 | Lexis: secondary store recap; Westlaw Advantage: **official FAQ** |
| UniCourt Professional UI (state + federal search; 50 searches/mo is tight — Premium $399 if needed) | $199 | $2,388 | $9.95 | Public list |
| DRI individual (defense expert DB) if eligible | $27.92 | $335 | $1.40 | Public list |
| TrialSmith downloads budget (files that must be retained) | ~$80 | ~$960 | $4 (e.g. 2 downloads × $40 × 12 months / 240) | Estimate on $28–$50 list |
| PACER extra for a heavy expert file | +$50 | +$600 | +$2.50 | Estimate |
| FLP commercial API | quote | quote | quote | Quote-only |
| UniCourt Enterprise API | quote (directory $2,250/user/mo **not used** in the total) | quote | quote | Quote-only |
| ABMS CertiFACTS (only if PDC Premium is insufficient for PSV dates) | quote | quote | quote | Quote-only |
| **Package C numeric subtotal (using Westlaw Advantage all-states, no quotes)** | **~$1,113** | **~$13,360** | **~$55.70** | Mix |
| **Package C numeric subtotal (using Lexis Professional 1-yr instead)** | **~$1,145** | **~$13,747** | **~$57.30** | Mix |

Package C seat minimums: Lexis self-serve is **1–3 attorneys**; Westlaw Advantage online is **new customers, ≤10 attorneys**. Neither forces more than **one seat** at 20 investigations/month. UniCourt Professional includes **2 users**. TrialSmith and DRI are memberships, not investigation-priced seats.

### Inferences

- **Package A is the correct production default until PDC and PACER credentials exist.** Residual cost is LLM tokens, not data.
- **Package B is the only stack whose dollars map onto missing report sections.** $12 PDC Premium is the highest-leverage line in the entire survey: it is cheaper than one Lexis out-of-plan “expert witness analysis” document ($100 on the 2 Oct 2026 Small Law snippet) and it is primary-source-equivalent for sanctions.
- **Depositions cannot be automated cheaply.** TrialSmith has no API; Westlaw/Lexis may contain some transcripts depending on plan (not verified as complete). Budget paralegal time separately — it will dwarf $749.
- **Do not climb to Package C to fix licenses, payments, or publications.** Those are already free or $12. Package C is for clients who want the same *database experience* opposing counsel has (CourtLink, verdicts, 50-state, UniCourt state dockets, DRI chatter).
- **Per-investigation planning numbers to put on a client sheet (typical, 20/month):** A **$0.20**; B **$18**; C **$56 + quotes**. State clearly that B’s TrialSmith $749 is a vendor “value” pending invoice, and C’s Lexis row is a secondary recap because the store 403’d on 27 Oct 2026.

### Gaps

- No vendor published a bundled “expert witness investigation” SKU. Package totals are sums, not quotes.
- TrialSmith, Lexis (today), UniCourt API, FLP commercial, ABMS CertiFACTS, and Westlaw Precision remain **quote or value-only**.
- Staff time, FOIA, court-reporter invoices, hosting, OCR, retries, and taxes are excluded (same exclusion as the 22 Oct internal estimate).
- Neuropsychology / ABPP-CN experts fall outside FSMB PDC. Package B does **not** close PhD-only license/discipline; that stays manual state-board lookup.

---

## What should NOT be bought (aggregators that duplicate NPI/Open Payments, catalog env vars with no adapter)

### Takeaway

Do not pay for identity, payments, or publication data you already pull from CMS, OpenAlex, and PubMed. Do not buy SEAK listings, standalone ABMS if PDC Premium is on, DocInfo (free), Lexis **and** Westlaw, stacked search APIs, Google Maps grounding, or criminal-record mills. Do not treat reserved env vars (`LEXISNEXIS_API_KEY`, Maps, UniCourt, unused STT keys) as “connected.” CourtListener membership keys are the wrong commercial vehicle.

### Cited Findings

- CMS NPI Registry and Open Payments are official, free REST sources. Commercial “provider data” aggregators that resell NPI/Open Payments are duplicative. — [NPI Registry](https://npiregistry.cms.hhs.gov/); [Open Payments](https://openpaymentsdata.cms.gov/)
- SEAK $655 is an expert **listing**, while attorney search of the directory is free. — [SEAK signup](https://www.seakexperts.com/signup); [2026 directory](https://seak.com/expertdirectory_2026/Expert_Directory_2026_1_web.pdf)
- FSMB PDC Premium already includes ABMS specialty at **+$3** over Standard. ABMS Solutions products are quote-only and aimed at credentialing PSV. — [PDC FAQ](https://www.fsmb.org/PDC/pdc-faq); [ABMS comparison](https://www.abmssolutions.com/product-solutions/product-comparison/)
- DocInfo consumer lookup is free. — [FSMB 2015 relaunch](https://www.fsmb.org/siteassets/advocacy/news-releases/2015/news-release-docinfo-relaunch.pdf)
- Gemini Maps grounding: 5,000 free/month on Gemini 3+, then **$14 / 1,000** (same as Search on Gemini 3). 2.5 Flash Maps: 1,500 RPD then **$25 / 1,000**. Unnecessary for EWI identity once NPI address exists. — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- YouTube `captions.download` requires edit permission; unofficial timedtext harvest is a ToS issue, not a SKU to buy. — [YouTube captions.download](https://developers.google.com/youtube/v3/docs/captions/download)
- FLP membership API is not for revenue-positive products. — [allowed API usage](https://free.law/membership/allowed-api-usage/)
- Internal provider register (names only, 22 Oct 2026) already flags catalog-only / unread keys: `LEXISNEXIS_API_KEY`, `GOOGLE_MAPS_API_KEY`, TrialSmith request flag default off, Deepgram/AWS/Azure STT proposed, commercial criminal/NPDB aggregators **reject**. NPDB is a restricted querying system, not a retail API.

**Do not buy (decision table):**

| Item | Why not | Better substitute |
|---|---|---|
| NPI / Open Payments aggregators | Official APIs are $0 | NPPES + CMS Open Payments |
| DocInfo “paid profiles” | Consumer tool is free; PDC is the paid professional product | PDC $9/$12 if you need a citable professional profile |
| SEAK $655 listing | You are investigating experts, not advertising them | Free SEAKexperts.com search |
| ABMS CertiFACTS if PDC Premium is on | Duplicate specialty field | PDC Premium $12 |
| Lexis **and** Westlaw | Overlapping caselaw seats at $4k–$5k each | One seat in Package C, or neither |
| UniCourt Enterprise API at directory $2,250/user/mo | ~$27k/year; no adapter; PACER+CL cover federal | PACER + CourtListener; UniCourt **UI** $199 only if state-docket volume justifies |
| Serper + Brave + Tavily together | Duplicate web search | Gemini grounding + at most one fallback |
| Serper Starter as default | $100/year expiry tax for ~10k queries | Gemini 3 free 5,000/mo or Brave $5 credits |
| Tavily Project $30 | 4,000 credits unused at 880/month | Free 1,000 credits |
| Google Maps Platform / Gemini Maps grounding | Office listing is not a report gap worth $14/1k | NPI practice address |
| Deepgram / AWS Transcribe / Azure Speech | Extra STT SKUs | AssemblyAI $0.21/hr already in catalog, or Gemini 3.5 transcribe ~$0.005/min blended |
| Cheap criminal / background APIs | Identity error; false “no record”; NPDB restricted | State courts + PACER + board actions via PDC |
| YouTube caption scrapers | ToS; captions.download is owner-only | Metadata via Data API; STT only on lawful files |
| CourtListener **membership** key for a sold EWI product | Explicitly disallowed for revenue-positive use | Free token within 125/day, or FLP commercial agreement |
| Reserved `.env` without adapters (`LEXISNEXIS_API_KEY`, Maps, UniCourt, unused STT) | Catalog ≠ connected | Leave unset |

### Inferences

- Almost every “optional premium” that looks like an investigation upgrade is either **already free**, **quote-only**, or **the wrong customer** (SEAK expert, DRI defense, ABMS hospital credentialer).
- The only paid lines that change report completeness at small-firm volume are **PDC, PACER, and TrialSmith**. Everything else is either residual LLM cost or a research-platform seat.

### Gaps

- Full current `.env.example` was not re-read line-by-line on 27 Oct 2026; catalog-only names are taken from the 22 Oct provider-register checklist as requested (names only).
- NPDB eligible-entity rules were not re-fetched; the “reject retail aggregator” recommendation stands on the restriction itself, not a 2026 price.
- Whether a PI software vendor can be a TrialSmith member (vs the law-firm customer operating the portal) is a licensing question, not a price. Package B assumes the **law firm** holds the membership and a human uses the portal.
