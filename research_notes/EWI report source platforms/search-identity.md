# Search, fetch, and identity platforms for EWI (2026)

**Checked:** 27 October 2026. **Currency:** USD.  
**Workload used for estimates:** 20 investigations/month × 64 planned search queries × 80 page fetches (current code caps).  
**Code path:** `apps/api/src/integrations/web-research/` plus YouTube/AssemblyAI adapters under `apps/api/src/integrations/expert-research/live/`.  
**Prior register:** `docs/ewi/provider-register.md` dated 22 October 2026 — re-verified against official pages on 27 October 2026; deltas noted below.

**Code caps (do not treat “64 queries” as 64 API calls):**

| Setting | Default env | What it actually limits |
|---|---|---|
| `WEB_SEARCH_MAX_QUERIES` | 64 | First-round planned topics across the **shared** query plan. Query planner emits ~61–66 first-round queries before attorney-note extras and up to 16 follow-ups, so 64 is already a cut. — `apps/api/src/config/research.config.ts`; `query-planner.ts` |
| Per-provider `budget` | Gemini = `maxQueries` (64); Serper 45; Brave 35; Tavily 25 | Each configured provider runs its own queue. If all four keys are set, one investigation can fire ~64+45+35+25 = **~169 search API calls**, plus Serper/Brave page-2 pagination on identity/social/video/directories/litigation/court/publications/IME/patents. — `web-research-engine.ts` `DEFAULT_WEB_PROVIDER_IDS`; provider `budget` fields |
| `WEB_FETCH_MAX_PAGES` | 80 | Direct HTTP fetches of hit URLs (the user’s “80 page fetches”). — `research.config.ts` |
| `WEB_SEARCH_MAX_PAGES` | 150 | Records kept in the dossier after clustering, **not** fetches. — `web-research-engine.ts` `.slice(0, maxPages)` |
| `WEB_RESEARCH_DEADLINE_MS` | 180_000 | Search half, fetch to 82%, then stop. Often binds before the numeric caps. |
| Demery regression fixture | 44 queries / 50 pages | Older typical-run assumption still used in tests; live default is 64/80/150. — `ewi-report.demery-regression.spec.ts` |

Monthly search-call range if **all** current providers are keyed: ~1,280 Gemini prompts + ~900 Serper + ~700 Brave + ~500 Tavily = **~3,380 search API calls/month**, plus pagination. Monthly fetches: **1,600**. YouTube `search.list`: **20/month** (one per investigation).

---

## Which search API is the best primary for attorney-grade EWI in 2026 (coverage vs cost vs ToS for storing snippets)?

### Takeaway
Keep **Gemini 2.5 Flash Google Search grounding as the discovery primary** and **Serper as the structured-Google co-primary**. At 20 investigations/month both stay near $0–$5 if Gemini stays on 2.5 (1,500 free grounded prompts/day). Do **not** make Brave the store-and-cite primary: self-serve ToS forbid retaining search results except transiently. Google Programmable Search JSON API is closed to new customers and dies 1 January 2027. Bing Web Search API was retired 11 August 2025.

### Cited Findings
- Gemini 2.5 Flash paid-tier Google Search grounding: **1,500 grounded prompts/day free** (shared with Flash-Lite), then **$35 / 1,000 grounded prompts**. Tokens: **$0.30 / 1M input**, **$2.50 / 1M output**. Billing for 2.5 is **per prompt**, not per inner search. — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) (page retrieved 27 Oct 2026); matches `docs/ewi/provider-register.md` (22 Oct 2026, pricing page then dated 19 Oct 2026).
- Gemini 3 and newer grounding: **5,000 free search requests/month** shared across Gemini 3+ models, then **$14 / 1,000 search requests**. One prompt can execute **multiple** billable queries. — [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search) (last updated 13 Oct 2026).
- Current EWI adapter hard-defaults the grounded model to `gemini-2.5-flash` and extracts `groundingChunks` / `groundingSupports`, not Gemini 3 Interactions `url_citation` annotations. — `providers/gemini-grounded.provider.ts`; `research.config.ts` `WEB_SEARCH_GEMINI_MODEL`.
- Serper prepaid packs on the public homepage: Starter **$50 / 50,000** = **$1.00 / 1k**; Standard **$375 / 500k** = **$0.75 / 1k**; Scale **$1,250 / 2.5M** = **$0.50 / 1k**; Ultimate **$3,750 / 12.5M** = **$0.30 / 1k**. Credits valid **6 months**. 2,500 free queries on signup. Credits deducted only on successful responses. Third-party recaps of the same packs: 6 Oct 2026 and 17 Sep 2026. — [serper.dev](https://serper.dev/); [Serper Pricing Explained (2026)](https://apiserpent.com/blog/serper-pricing-credits-explained); [AnswerLine Serper packs checked 2026-09-17](https://answerline.dev/compare/serper/).
- A July 2026 third-party analysis (ColdIQ, cited by ApiSerpent) claimed 11–100 results cost **two** credits; that rule was **not** on Serper’s homepage as of 6 Oct 2026. EWI requests `num` 20, so confirm with Serper before budgeting a 2× rate. — [Serper Pricing Explained (2026)](https://apiserpent.com/blog/serper-pricing-credits-explained); `serper.provider.ts` `num: request.num ?? 10`.
- Serper ToS (updated 29 May 2024): B2B license to use materials “for as long as your use case requires”; forbid mirroring “as-is with no-value-added”; forbid misrepresenting ownership/source of third-party Data; **no explicit ban on storing snippets in a customer report**. Third-party content remains the publisher’s. — [serper.dev/terms](https://serper.dev/terms).
- Brave Search self-serve **Search** plan: **$5 / 1,000 requests**, 50 qps, **$5 free credit/month** (= 1,000 Search requests). Answers: **$4 / 1,000** + **$5 / 1M tokens**. Independent index; LLM Context, news, videos, images included in Search. — [brave.com/search/api](https://brave.com/search/api/); [Brave Search API pricing docs](https://api-dashboard.search.brave.com/documentation/pricing); [Brave 12 Feb 2026 launch post, updated 25 Jun 2026](https://brave.com/blog/most-powerful-search-api-for-ai/).
- Brave Search API Terms (standard self-serve): Customer shall not “**store, cache, or create a database of Search Results**, in whole or in part, **other than transient storage** required for operation of Customer Applications.” Help center: “It is prohibited to retain any and all data received through the Brave Search API” unless storage rights are negotiated. FAQ on marketing page: storage yes **with a plan that includes storage rights**. — [Brave Search API Terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service); [Help & Feedback](https://api-dashboard.search.brave.com/documentation/resources/help-feedback); [brave.com/search/api](https://brave.com/search/api/).
- Tavily: Free Researcher **1,000 credits/month**; PAYG **$0.008/credit**; Project **$30 / 4,000** ($0.0075) through Growth **$500 / 100,000** ($0.005). Basic Search = **1 credit**; Advanced Search = **2**; Basic Extract = **1 credit per 5 successful URLs**. Credits reset on the 1st of each month. — [Tavily pricing](https://www.tavily.com/pricing); [Credits & Pricing](https://docs.tavily.com/documentation/api-credits) (also recapped 12 Oct 2026 at [katteb.com/blog/tavily-ai-agent](https://katteb.com/blog/tavily-ai-agent/)).
- Tavily Platform Terms (last updated 4 May 2026): Search/Extract Output is distinct from “Services”; Customer may integrate APIs with Customer Applications for **internal business purposes**. Section 3.2(xvi): no automated decisions without human oversight in high-risk **legal** contexts. Section 6.4 (AI Functionality / Research, not basic Search): “you will not use the AI Functionality or Outputs in connection with … **legal proceedings or legal advice**.” — [tavily.com/terms](https://www.tavily.com/terms).
- Google Custom Search JSON API: **closed to new customers**; existing customers **until 1 January 2027**; **100 free queries/day**, then **$5 / 1,000**, cap **10,000/day**. New Programmable Search Engines limited to **50 domains**; full-web option removed. Vertex AI Search is the stated replacement (quote for full web). — [Custom Search JSON API overview](https://developers.google.com/custom-search/v1/overview) (last updated 18 Feb 2026).
- Bing Web Search / Custom Search APIs **retired 11 August 2025**; no new signups; existing instances decommissioned. Microsoft points to **Grounding with Bing Search** (Azure AI Agents / Foundry `web_search` tool), not a drop-in results API. Third-party recap (29 Sep 2026): Grounding with Bing listed at **$14 / 1,000 grounding transactions**. — [Microsoft Lifecycle announcement](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement); [Bing Web Search product page](https://www.microsoft.com/en-us/bing/apis/bing-web-search-api); [Valyu recap 29 Sep 2026](https://www.valyu.ai/blogs/bing-search-api-is-dead-now-what).
- 2026 licensed-extract alternatives (page **text**, not Google rank): Exa search includes webpage text/highlights — Lite **$4 / 1k**, Auto **$7 / 1k**; standalone Contents **$1 / 1k pages**. Parallel Search Turbo/Fast **$1 / 1k** (excerpts only); Extract **$1 / 1k URLs**; Entity Search **$5 / 1k** (100 results). Firecrawl scrape **1 credit/page**, search **2 credits per 10 results**; Standard **$99 / 100k credits**. — [exa.ai/pricing](https://exa.ai/pricing); [docs.parallel.ai/getting-started/pricing](https://docs.parallel.ai/getting-started/pricing); [firecrawl.dev/pricing](https://www.firecrawl.dev/pricing).
- EWI already uses Serper for **web, news, places, scholar** and pagination; Gemini for **web, news, scholar** (no `page`); Brave web/news; Tavily web/news at `search_depth: 'basic'` (no Extract call today). — `serper.provider.ts`, `gemini-grounded.provider.ts`, `brave.provider.ts`, `tavily.provider.ts`.

**Workload cost, 20 investigations/month (USD, 27 Oct 2026):**

| Primary (64 queries × 20 = 1,280 calls) | Per 1k | Per investigation | Per month | Notes |
|---|---:|---:|---:|---|
| Gemini 2.5 Flash grounding (under 1,500 RPD) | $0 | ~$0.05–$0.20 tokens | **~$1–$4 tokens** | 20×64=1,280 prompts. Even **all 20 on one day** is under 1,500 RPD. Register’s $1.54/investigation only applies **after** RPD. |
| Gemini 2.5 Flash grounding (over RPD) | $35 | $2.24 + tokens | **$44.80 + tokens** | Only if a single day exceeds 1,500 grounded prompts (would need >23 investigations at 64, or a higher cap, or Gemini 3 multi-query blow-up). |
| Gemini 3+ grounding (after 5,000 free searches/month) | $14 | depends on inner queries | **$0** if inner searches ≤5,000; else $14 per extra 1k | One EWI prompt can fire several Google queries. 1,280 prompts could become 2k–4k searches. **Do not switch the live adapter to Gemini 3 without measuring inner-query count.** |
| Serper Starter | $1.00 | $0.064 | **$1.28** | 1,280 queries. Starter $50 pack (50k credits / 6 months) covers ~39 months at this volume; unused credits expire. |
| Brave Search | $5.00 | $0.32 | **$1.40** after $5 free credit ($6.40 gross) | ToS problem for stored reports (see below). |
| Tavily basic Search (PAYG) | $8.00 | $0.512 | **$6.40** after 1,000 free credits ($10.24 gross) | 1,280 credits; free 1,000 leaves 280 × $0.008. Project $30/4k is cheaper if Tavily is primary. |
| Google CSE (legacy only) | $5.00 | $0.32 | **$6.40** after 100/day free | Closed to new customers; gone 1 Jan 2027. |
| Bing Web Search | n/a | n/a | **n/a** | Retired 11 Aug 2025. |
| Exa Auto (text included) | $7.00 | $0.45 | **$9** | Attractive if replacing **fetch**, not just SERP. |
| Parallel Fast + Extract of 80 URLs | $1 + $1/1k URLs | $0.064 + $0.08 | **~$2.90** | Search 1,280 × $0.001 = $1.28; extract 1,600 × $0.001 = $1.60. |

Fan-out if **Gemini + Serper + Brave + Tavily** all keyed (current default provider list): monthly **~$1–$4 Gemini tokens + $0.90 Serper + $0 Brave (under $5 credit) + $0 Tavily (under 1,000 free)** ≈ **$2–$5**, with Brave retention ToS as the legal issue not the bill.

### Inferences
- For attorney-grade EWI the ranking criterion is **citable URL + page text the code can identity-match**, not a grounded essay. Gemini grounding is the cheapest Google-coverage discovery channel **if** the pipeline still fetches (or Extract-licenses) the cited URL. Serper is the only current adapter that also returns **places, scholar, news endpoint, and page=2**, which maps to empty IME/directory/maps sections.
- Brave is a good **second index** (non-Google) at this volume because $5/month free credit covers 1,000 of the ~700 Brave calls, but storing Brave snippets in a durable investigation dossier likely needs an **Enterprise/Order Form with storage rights**. Until that exists, treat Brave hits as **ephemeral leads**: use the URL, fetch the page yourself (or via Tavily Extract), and do not persist Brave `description` as evidence.
- Tavily should not be the **primary SERP**. Basic Search is 5–8× Serper Starter. Tavily’s value is **Extract** (licensed page text, 1 credit / 5 successful URLs = **$0.0016/page PAYG**, **$2.56/month** for 1,600 fetches) when `SafeFetcher` hits a bot wall. Tavily **Research / AI Functionality** is a poor fit: terms discourage use in legal proceedings.
- Google CSE is not a 2026 build target. Bing Web Search is gone. Azure Bing grounding is an LLM-answer product at Gemini-3-like prices, not a ranked-results API.

### Gaps
- No official published **physician-directory / IME-ad / news** recall comparison of Serper vs Brave vs Gemini vs Tavily on named US physicians. Coverage ranking above is inferred from index (Google vs independent), endpoint surface (places/scholar/news), and what EWI already codes.
- Serper’s possible 2-credit rule for >10 results is **unconfirmed on the homepage**. EWI asks for 20 organic results.
- Gemini 3 inner-query multiplier for EWI-style “find this exact person” prompts is **unmeasured**. Switching `WEB_SEARCH_GEMINI_MODEL` to a Gemini 3 SKU could leave the 5,000 free/month bucket or multiply cost.
- Brave Enterprise storage-rights price is unpublished.
- Firecrawl/Exa/Parallel **ToS vs target-site robots.txt** were not line-audited here; they are licensed **vendor** crawls, not a license to bypass a site’s own terms. Do not use them to defeat login/CAPTCHA on LinkedIn, MQA, or Sunbiz.

---

## What does Gemini grounding actually return vs a Serper+fetch pipeline?

### Takeaway
Gemini grounding returns **the model’s synthesized answer plus citation metadata** (redirect URIs, titles, and which **answer sentences** those URIs support). It does **not** return the physician’s page HTML. Serper returns **organic title / URL / short snippet** (and news/places/scholar). Usable physician text in EWI today comes from **`SafeFetcher` after either source**, plus identity clustering. Grounding prose is already coded as a **lead, never a finding**.

### Cited Findings
- Google documents that a grounded Generate Content response includes `groundingMetadata`: `webSearchQueries`, `searchEntryPoint.renderedContent` (HTML/CSS for required Search Suggestions), `groundingChunks[].web.{uri,title}`, and `groundingSupports` mapping **model text segments** to chunk indices. Example `uri` values are `https://vertexaisearch.cloud.google.com.....`. — [Grounding with Google Search (Generate Content / legacy)](https://ai.google.dev/gemini-api/docs/generate-content/google-search).
- Gemini 3 Interactions API instead returns `google_search_call` queries, `search_suggestions` HTML, and `url_citation` annotations on **model output** (`url`, `title`, `start_index`, `end_index`). Still no page body. Docs say display of Search Suggestions is required by the Terms of Service. — [Grounding with Google Search (Interactions)](https://ai.google.dev/gemini-api/docs/google-search) (updated 13 Oct 2026).
- EWI’s adapter: (1) sends the query-planner `prompt` plus an instruction not to list other people; (2) reads `groundingChunks` and `groundingSupports`; (3) joins support **segment text** (model words, max 600 chars) onto the hit as `snippet`/`lead`; (4) **HTTP-resolves** `vertexaisearch.cloud.google.com` redirects (up to 3 hops, 8s) to a citable URL; (5) hangs the full model `answer` on the first hit; (6) also regex-extracts social URLs from the answer. Comment in code: “The model’s short answer is kept on those hits as a research lead and is never itself a finding.” — `gemini-grounded.provider.ts`.
- Serper `/search`, `/news`, `/places`, `/scholar` return organic `title`, `link`, `snippet`, optional `date`; places add address/phone/rating. EWI then fetches the `link`. — `serper.provider.ts`.
- After search, the engine fetches up to `maxFetchPages` (80) with robots.txt, private-IP block, Cloudflare/Incapsula/PerimeterX/DataDome/CAPTCHA markers, paywall markers, and optional Internet Archive fallback. Page text (not the SERP snippet) is what identity-assess and claim extraction read. — `safe-fetcher.ts`; `web-research-engine.ts`.
- Gemini has **no `page` parameter**; Serper and Brave paginate selected topics. — `query-planner.ts` comment; `PAGINATING_SEARCH_PROVIDERS` in `web-research-engine.ts`.
- Grounding can be combined with Google’s **URL context** tool to ground on specific URLs as well as Search. EWI does not enable URL context today. — [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search).
- Provider-register rule (22 Oct 2026, still correct): “Display grounding as required by Google; do not treat model prose as evidence.” — [docs/ewi/provider-register.md](https://github.com) local `docs/ewi/provider-register.md`; Google docs above.

### Inferences
- Empty IME/news/practice sections are usually **fetch failures or identity non-attribution**, not “Gemini didn’t search.” A grounded hit whose resolved URL 403s/CAPTCHAs still produces a blocked-page limitation, not a filled section.
- Serper+fetch is better when you need **many ranked URLs** (directory `site:` queries, page 2, maps). Gemini is better when Google would surface a non-obvious biography and the model’s query rewrite helps, but you still must fetch.
- Using Gemini **without** fetch (citing only `groundingSupports` text) would quote **the model**, not the physician’s site — unsafe for attorney-grade reports. The current “lead not finding” split is the right architecture.
- URL-context-on-resolved-hits is a legal, ToS-native way to get Google to **read** a URL the SERP already found, if first-party fetch fails and Tavily Extract is not used. It is **not** a CAPTCHA bypass; Google will still fail on walls it cannot read.

### Gaps
- No measured hit-list size for EWI Gemini prompts vs Serper `num=20` on the same physician. Code allows Gemini 3 concurrent requests and 1024–2048 output tokens; typical chunk count per prompt is not logged in this research.
- Whether EWI currently renders Google’s required `searchEntryPoint` widget in the product UI was not verified in this pass (register says display is required).
- Vertex AI Search / Gemini URL context **pricing** when used together with Search grounding was not separately priced (grounding rates above still apply to the Search tool).

---

## YouTube: Data API search vs captions (cannot download others’ captions); cost of 100 search.list/day quota?

### Takeaway
Use **YouTube Data API `search.list` + `videos.list`** for video IDs, titles, channels, and a **captions-exist flag**. **Do not download third-party captions.** Default quota is **100 `search.list` calls per day at $0**; 100/day is a **unit cap, not a bill**. At 20 investigations/month (1 search each) the quota is ample. Extra quota requires a YouTube compliance audit, not a price card.

### Cited Findings
- Default project allocation: **100 `search.list` / day**, **100 `videos.insert` / day**, and **10,000 units / day** for all other methods. Quotas reset midnight Pacific Time. `search.list` lives in its **own bucket**; cost **1 unit per call** in that bucket. Additional result pages each cost another call. Extra quota requires a **compliance audit** against the YouTube API Services ToS. — [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost); [Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits).
- `search.list` docs: “Quota impact: 100 calls per day. A call to this method has a quota cost of 1 unit in the Search Queries quota bucket.” — [Search: list](https://developers.google.com/youtube/data/reference/rest/v3/search/list).
- `captions.download`: **200 units** per call from the shared 10,000-unit pool; “**This method requires the user to have permission to edit the video.**” OAuth scopes `youtube.force-ssl` or `youtubepartner`. — [Captions: download](https://developers.google.com/youtube/data/reference/rest/v3/captions/download).
- `captions.list` returns track **metadata only** (50 units), not the caption text. — [Captions resource](https://developers.google.com/youtube/data/reference/rest/v3/captions); quota table on [determine_quota_cost](https://developers.google.com/youtube/v3/determine_quota_cost).
- `videos.list` costs **1 unit** from the 10,000 pool (not the search bucket). — [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost).
- EWI: one `search.list` plus one `videos.list` when `YOUTUBE_API_KEY` is set; default `YOUTUBE_MAX_RESULTS=25`; transcripts are never fetched; caption flag stored; watch URLs are never sent to AssemblyAI. Fallback without a key is web `site:youtube.com`. — `youtube.provider.ts`; `direct-media.ts`; `docs/ewi/provider-register.md`.
- Unofficial timedtext / `yt-dlp` caption harvest is **rejected** by project rules and YouTube ToS. AssemblyAI’s own cookbook tells developers to **download YouTube audio with yt-dlp then upload** — that is **not** a lawful path for other people’s videos in this product. — [AssemblyAI FAQ: How can I transcribe YouTube videos?](https://www.assemblyai.com/docs/faq/how-can-i-transcribe-youtube-videos); [yt-dlp cookbook](https://www.assemblyai.com/docs/pre-recorded-audio/guides/transcribe_youtube_videos); local register “Not recommended” table.

**Cost of 100 `search.list`/day:** **$0 list price** (included in the free default quota). Dollar cost of using the full 100 on one calendar day: **$0**. Opportunity cost: a second investigation the same day that needs `search.list` fails until PT midnight unless extra quota is granted via audit. 20 investigations/month ≈ 20 `search.list` + 20 `videos.list` (20 units of 10,000) ≈ **well under both buckets** even if all 20 run on one day.

### Inferences
- YouTube Data API search is the correct way to stop empty “YouTube / presentations” sections that today depend on Gemini/Serper `site:youtube.com` luck. Enable `YOUTUBE_API_KEY`; keep the existing name+specialty attribution gate.
- Captions cannot fill testimony/lecture transcript sections for third-party videos. If a lecture is also posted as a **direct public mp3/mp4** (university CDN, SoundCloud file URL, Vimeo progressive file if permitted), that is an AssemblyAI problem, not a YouTube captions problem.
- Do not raise `search.list` above 1 per investigation without a quota plan: 20 investigations in one day still fits; a retry loop or per-query YouTube searches (planner already has two video web queries) would burn the 100-call bucket if someone later wires every planned video query to `search.list`.

### Gaps
- Google does not publish a **dollar price** for raising the 100 `search.list`/day cap; the path is audit, not a rate card.
- Whether `videos.list` `contentDetails.caption` is a reliable “captions exist” signal for auto-captions vs human captions was not re-tested here (code already treats the flag as metadata only).

---

## USPTO ODP: ID.me barrier and whether it is worth it for expert patents.

### Takeaway
ID.me is a **real, one-time identity-verification barrier** on the **API key**, not on Google Patents HTML. For EWI volume, ODP is **worth completing for one staff identity** because it is free, quotas are huge, and inventor-name collision is exactly the failure mode web search cannot solve. It is **not** worth blocking report shipping: keep `site:patents.google.com` as the always-on path; add ODP as a confirmatory adapter after the key exists.

### Cited Findings
- Starting **18 June 2026**, all ODP website use requires a USPTO.gov account with **MFA**. API keys have **always** required USPTO.gov **+ ID.me verification**. Linking ID.me is described as **one-time**. — [Register for ODP access](https://data.uspto.gov/support/universal-registration); [USPTO ODP Newsletter May 2026](https://data.uspto.gov/documents/documents/USPTO-ODP-Newsletter_May_2026.pdf); [ODP FAQs](https://data.uspto.gov/support/faq).
- Effective **18 August 2026**, four profile fields are required: Job Title, Organization Name, Organization Type, Intended Use. Keys for accounts that missed the **8 October 2026** deadline were **deactivated**; reactivate by filling fields and clicking Activate API Key (same key, not a new one). — [Manage API Key](https://data.uspto.gov/apikey); [ODP FAQs](https://data.uspto.gov/support/faq).
- Official rate limits (page retrieved 27 Oct 2026): Meta-data APIs **5 million calls/week**; Patent File Wrapper Documents API **1.2 million/week**; weekly reset **Sunday midnight UTC**; **burst = 1** (one in-flight call per key); sequential rate **4–15 req/s** by call type; HTTP 429 if parallel; USPTO “strongly discourage[s] automatic retries without at least 5 second delay.” Bulk file: 20 downloads/year of the **same** file per key (XML higher); 5 files / 10 seconds / IP. Price: **$0**. — [data.uspto.gov/apis/api-rate-limits](https://data.uspto.gov/apis/api-rate-limits).
- EWI patents path today: three web queries (generic patent, `site:patents.google.com`, trademarks) plus host matching on `patents.google.com` / `uspto.gov` / `ppubs.uspto.gov` / `wipo.int`. USPTO ODP is **catalog-only** (`USPTO_API_KEY` reserved). — `query-planner.ts`; `web-source-providers.ts`; `docs/ewi/provider-register.md`.
- Query planner already deprioritizes dropping patents when the 64-query budget is tight (`QUERY_PRIORITY.patents = 14` vs news = 40). — `query-planner.ts`.

### Inferences
- **Worth it:** one ID.me-verified staff USPTO.gov account, complete the four profile fields, store `USPTO_API_KEY` in secrets (not git), call search **sequentially**. At 20 experts/month even hundreds of metadata calls are a rounding error vs 5M/week. The payoff is **application number / inventor / assignee** records that survive same-surname collisions (e.g. multiple “J. Smith, MD” inventors).
- **Not worth delaying reports:** most physicians have **zero** patents; Google Patents HTML via Serper/Gemini plus “missing listing is not proof” wording already matches attorney-grade caution. ODP does not fill **IME ads or news**.
- Do not scrape `ppubs.uspto.gov` or Patent Public Search UI; that is the bot-wall class this project refuses. ODP is the official API substitute.

### Gaps
- No EWI production statistic on how often the patents section is empty **because** Google Patents missed a true inventor hit vs because the expert has no patents.
- Trademark search (TESS / TSDR) is a **different** USPTO stack than ODP patent APIs; TSDR has its own peak/off-peak limits on third-party CLI docs. This note does not treat TSDR as ODP.
- ID.me personal-vs-work email duplicate-account friction is documented in FAQs but success rate for a law-firm staff signup was not observed.

---

## Transcripts: AssemblyAI vs alternatives for public mp3/mp4 only.

### Takeaway
Keep **AssemblyAI Universal-3.5 Pro async ($0.21/hour)** as the default for **direct public media URLs only**. It is cheaper than Google STT and AWS, similar to Deepgram, and already coded with YouTube-watch rejection. No STT vendor searches YouTube or returns other people’s captions. Worst-case EWI cap (2 files × 30 min × 20 investigations) is **~$2.10–$4.20/month**.

### Cited Findings
- AssemblyAI public rate card (authoritative page updated **28 Sep 2026**; model launch **7 Jul 2026**): Universal-3.5 Pro async **$0.21/hr** billed per second, no minimums; Universal-2 **$0.15/hr**; diarization **+$0.02/hr**; Medical Mode **+$0.15/hr**; **$50 free credits**, no card. Streaming/Sync **$0.45/hr** (not needed for batch lectures). — [assemblyai.com/pricing](https://www.assemblyai.com/pricing); [Universal-3.5 Pro launch](https://www.assemblyai.com/blog/universal-3-5-pro-async); matches register 22 Oct 2026.
- `audio_url` must be a **direct, publicly downloadable** audio/video file. YouTube watch URLs fail transcoding. — [AssemblyAI FAQ: audio URLs](https://www.assemblyai.com/docs/faq/what-types-of-audio-urls-can-i-use-with-the-api); [FAQ: YouTube](https://www.assemblyai.com/docs/faq/how-can-i-transcribe-youtube-videos); [common errors example with a youtube.com/watch URL](https://www.assemblyai.com/docs/pre-recorded-audio/guides/common_errors_and_solutions).
- AssemblyAI’s July 2026 comparison table (vendor blog, treat as directional): Deepgram Nova-3 batch **~$0.26/hr**; Google Cloud Speech batch **~$0.48/hr** (~$0.016/min); AWS Transcribe **~$1.44/hr**; OpenAI Whisper **~$0.36/hr**. Register (22 Oct 2026) independently listed GCP V2 standard ~$0.016/min first 500k min (30 min ≈ $0.48), Deepgram ~$0.26–$0.46/hr, AWS ~$0.024/min (30 min ≈ $0.72), Azure batch ~$0.18/hr (30 min ≈ $0.09). Azure/GCP/AWS **official price cards were not re-opened in this pass**; the AssemblyAI $0.21/hr and Google’s need to confirm on cloud.google.com remain. — [AssemblyAI STT pricing guide](https://www.assemblyai.com/blog/speech-to-text-api-pricing); `docs/ewi/provider-register.md`.
- EWI: `EWI_TRANSCRIPTION_ENABLED` default true; cap **2 files / 30 minutes**; YouTube hosts skipped in `probeDirectMedia`; AssemblyAI client never sends watch URLs. — `research.config.ts`; `direct-media.ts`; `assemblyai.client.ts`.
- 30 min at $0.21/hr ≈ **$0.105**; 20 investigations × 2 × 30 min = 20 hours ≈ **$4.20** absolute cap; typical is far lower because most experts have no public mp3/mp4.

### Inferences
- Do not add Deepgram/GCP/AWS unless AssemblyAI accuracy fails on medical/legal speech **or** a BAA/region requirement appears. Medical Mode (+$0.15/hr) is the cheaper accuracy lever than switching vendors.
- Transcripts will not un-empty YouTube sections. Discovery (YouTube Data API) and transcription (direct file) are sequential, lawful steps.
- Azure ~$0.09 / 30 min in the 22 Oct register would be cheaper **if** that batch SKU is confirmed on the Azure price card; it is still “proposed,” not coded. Prefer confirming Azure before a second integration.

### Gaps
- Official Google Cloud Speech-to-Text V2, Deepgram console, Azure AI Speech, and AWS Transcribe price cards were **not fetched on 27 Oct 2026**; figures above mix AssemblyAI’s July 2026 roundup and the 22 Oct register. Re-open vendor consoles before buying a second STT.
- No measured WER on expert-witness lectures (medical terms, Daubert, IME) for Universal-3.5 Pro vs Nova-3.

---

## What combination most reduces empty “web presence / IME ads / news” report sections without illegal scraping?

### Takeaway
Empty sections are mostly **(1) 64-query budget dropping news, (2) 80-fetch/180s deadline, (3) bot walls on directories/news/state sites, (4) surname collision discarding true hits**. The lawful stack: **Gemini 2.5 grounding + Serper (co-primary) + Tavily Extract only on fetch-fail URLs + YouTube Data API + Google News RSS/GDELT (already on) + identity clustering unchanged + optional USPTO ODP**. Do not add Firecrawl/browser automation, YouTube caption scrapers, or login-wall bypass. Raising `WEB_SEARCH_MAX_QUERIES` to ~80 and spending Extract credits on **blocked high-value hosts** will do more than adding a fifth SERP API.

### Cited Findings
- Query planner emits dedicated `site:` queries for SEAK, JurisPro, ExpertPages, DRI, ALM, ExpertLaw, ExpertWitness.com, plus six extra directory hosts, IME/advertising prompts, news (including Court TV/Law360/AP), and eight social hosts. News/reviews/places sit at priority 40–43 and are **first dropped** when `maxQueries` is 64. — `query-planner.ts` `QUERY_PRIORITY`, `planQueries`.
- Catalog sources mark “not a dedicated search” when the topic never ran — which produces empty-looking sections that are actually **budget skips**, not negative findings. — `web-source-providers.ts` `dedicatedSearchRan`; `section-router.ts` omitted-topic wording.
- `SafeFetcher` refuses private IPs, honors robots.txt, detects Cloudflare / Incapsula / PerimeterX / DataDome / CAPTCHA / paywall strings, and may retry via Internet Archive. Florida Sunbiz and DOH MQA are already documented as **often 403 / session walls**; LinkedIn is login-walled. Project rule: do not bypass. — `safe-fetcher.ts`; `docs/ewi/provider-register.md` Justia/Sunbiz/MQA rows.
- Tavily Extract: **not charged on failed URLs**; basic = 1 credit / 5 successes ≈ **$0.0016/URL PAYG**. 80 fetch-fails replaced by Extract ≈ **16 credits ≈ $0.13/investigation** or **$2.56/month** at 1,600 pages if **every** fetch used Extract (upper bound). Current Tavily adapter calls **Search only**. — [Tavily credits](https://docs.tavily.com/documentation/api-credits); `tavily.provider.ts`.
- Identity: `surname_only` mentions are not used as fingerprints; a page joins the subject only with profession, place, NPI, or intake-note agreement; other-person groups are kept separate. Gemini closer text: “Do not list other people who share a similar name.” Search APIs themselves do **not** disambiguate. — `identity-clusterer.ts`; `identity-assess.ts`; `gemini-grounded.provider.ts`.
- Parallel **Entity Search** is **$5 / 1,000** with 100 results, aimed at people/companies — a possible future disambiguation aid, not a replacement for NPI/ORCID. — [Parallel pricing docs](https://docs.parallel.ai/getting-started/pricing).
- Firecrawl Standard **$99/100k credits** can scrape JS-heavy pages; that is still **scraping**, often used specifically where first-party fetch fails. Not recommended under the “no CAPTCHA/robots/login bypass” constraint. — [Firecrawl pricing](https://www.firecrawl.dev/pricing).
- CAPTCHA/bot-wall **failure-rate statistics** for named-physician pages are **not published** by Serper, Brave, Tavily, or Google. This research found **no reliable numeric failure rate**. Qualitative: login walls (LinkedIn/Facebook) ≈ 100% unread; state boards and Sunbiz **commonly** blocked in this codebase’s own comments; practice sites and Google Patents **often** readable; news **often** paywalled (detected, not bypassed).

**Recommended combination (lawful, mapped to empty sections):**

| Empty section | What actually fills it | What not to do |
|---|---|---|
| Web presence / practice site | Gemini + Serper identity/portrait queries; fetch or Tavily Extract on the expert’s own host; archive fallback | Headless Chrome vs Cloudflare |
| IME ads / directories | Keep directory `site:` queries high-priority (already); Serper page-2; Extract on SEAK/JurisPro/etc. when fetch is bot-blocked **and** robots/ToS of those directories allow vendor extract | Scrape member-only DRI/SEAK |
| News | Raise query budget so `news` (priority 40) actually runs; keep Google News RSS + GDELT; Serper `kind: 'news'`; store URL + visible snippet; paywall = limitation | Paywall bypass |
| YouTube | `YOUTUBE_API_KEY` `search.list` | timedtext / yt-dlp |
| Patents | Google Patents via search now; USPTO ODP later for confirmatory inventor IDs | ppubs UI scrape |
| Same-surname junk | Existing clusterer + NPI/ORCID/OpenAlex **before** attributing news/IME | Cheap background-check APIs |

**Should caps change?**

- **`WEB_SEARCH_MAX_QUERIES` 64 → ~80:** planner already has ~61–66 first-round queries; 64 drops news/reviews and most follow-ups. Cost of +16 Gemini 2.5 prompts: **$0** under RPD; +16 Serper: **+$0.32/month**. This is the cheapest empty-news fix.
- **`WEB_FETCH_MAX_PAGES` 80:** keep, but add **Tavily Extract (or Exa Contents / Parallel Extract) as a fallback on `botBlocked` URLs** rather than raising blind fetch count. Extra fetches against Cloudflare waste deadline.
- **`WEB_RESEARCH_DEADLINE_MS` 180s:** likely the real limiter once queries rise. Measure before raising; Gemini concurrency is 3, Serper 4, Brave 1.
- **Do not** enable all four SERP APIs on every query long-term: diminishing recall, Brave retention ToS, Tavily Search cost. Prefer **Gemini + Serper always**, Brave only if Google returns thin independent-index needs, Tavily **Extract** not Search.

**Monthly cost of the recommended stack at 20 investigations (order of magnitude):** Gemini tokens **~$1–$4** + Serper **~$1.30** (or $0 while 2,500 signup + leftover pack credits last) + Tavily Extract **$0–$2.56** + YouTube **$0** + AssemblyAI **$0–$4.20** + USPTO **$0**. **Total typically <$10/month**; worst case still **<$15** plus any Brave storage contract if you insist on persisting Brave JSON.

### Inferences
- The 22 Oct 2026 register’s “typical 44 queries” understates the live 64-query default and the **fan-out**. Re-cost on **provider.budget × investigations**, not on `maxQueries` alone.
- Identity collision is not a search-API feature gap; it is why **page text** (fetch/Extract) plus NPI beats a longer snippet. Buying Exa Auto ($9/month) to include text in the SERP is optional; Tavily Extract-on-fail is cheaper and closer to current code.
- Attorney-grade ToS posture: persist **publisher URLs and first-party-fetched (or Extract-licensed) quotes**; treat SERP snippets as leads; treat Gemini answers as leads; treat Brave JSON as non-retainable without a storage addendum.

### Gaps
- No live run on 27 Oct 2026 measuring: fraction of the 80 fetches that return `botBlocked`, archive-fallback success rate, or how often `news` is in `omittedTopics` at maxQueries=64.
- Directory sites’ robots.txt / terms for Tavily/Exa/Parallel Extract were not fetched host-by-host (SEAK, JurisPro, DRI, ALM). Extract should be **allowlisted per host** after that check.
- Numeric CAPTCHA failure rates: **I found no reliable sources.**
- Gemini Search Suggestions display compliance in the EWI Word/UI report was not verified in this pass.
