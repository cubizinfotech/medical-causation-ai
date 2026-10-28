# EWI live pipeline code gaps

Research date: 27 October 2026. Code inspected in workspace `d:\medical-causation-ai`. No live investigation was started. No paid API was called. No `.env` secrets were read. Historic job outputs (Demery Word (9), PDF `192fdaa2`) were not re-run; citations of those files come only from dated docs.

Three layers must be kept separate:

1. **Catalog label** — a row in `EXPERT_RESEARCH_CATALOG` (`provider-catalog.ts`). `liveImplemented: true` is not proof of a dedicated API.
2. **Dedicated adapter** — a typed class constructed in `createLiveSourceProviders` (`live-sources.ts`).
3. **Live-path invocation** — `InvestigationWorkflow` calls `collectProviders` for every catalog id in `EWI_WORKFLOW_STAGES`. In live mode that either hits a dedicated adapter, a `WebSourceProvider` sharing one `WebResearchEngine` run, or `CatalogExpertResearchProvider` which returns `unavailable` without a network call.

## What does RESEARCH_PROVIDER=live actually call today (createLiveSourceProviders, web-research-engine, CV comparison, report sections)?

### Takeaway
Live mode is not “four sources.” It constructs ten always-on dedicated adapters plus optional YouTube, then fills ~35 remaining catalog ids from one shared public-web engine when at least one search provider is configured. CV comparison and the 41-section report (template **3.10.7**) consume that mix; they do not call paid legal or credential databases.

### Cited Findings
- `RESEARCH_PROVIDER` is read in `researchConfig()`; only the value `live` enables live mode, otherwise mock. Default in `.env.example` is `mock`. — [research.config.ts](file:///d:/medical-causation-ai/apps/api/src/config/research.config.ts)
- `createExpertResearchRuntime()` builds a `WebResearchEngine` only when `mode === 'live'` **and** `settings.web` exists. `createCatalogProviders()` then calls `createLiveSourceProviders(EXPERT_RESEARCH_CATALOG, runtime.live)` and falls back to `CatalogExpertResearchProvider` for every catalog id not in that map. — [expert-research.service.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/expert-research.service.ts)
- Dedicated adapters always constructed when their catalog row exists: `npi_registry` (`NpiRegistryResearchProvider`), `open_payments` (`OpenPaymentsResearchProvider`), `openalex` (`OpenAlexResearchProvider`), `justia` (`JustiaResearchProvider`), `pubmed` (`PubMedResearchProvider`), `grants` (`NihReporterResearchProvider`), `orcid` (`OrcidResearchProvider`), `courtlistener` (`CourtListenerResearchProvider`), `state_license` and `state_discipline` (both `FloridaLicenseResearchProvider` against Florida MQA). YouTube (`YoutubeResearchProvider`) is constructed **only if** `settings.youtubeApiKey` is set. — [live-sources.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/live-sources.ts)
- After dedicated adapters, `createWebSourceProviders(definitions, webEngine)` fills every `WEB_RESEARCH_SOURCE_IDS` id that does not already have an adapter. Comment in code: Justia, CourtListener, and YouTube-when-keyed keep their own searches. — [live-sources.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/live-sources.ts)
- `WEB_RESEARCH_SOURCE_IDS` (35 ids) as of this workspace: `web_search`, `news`, `blogs`, `social`, `expert_directory`, `dri`, `seak`, `alm_law`, `jurispro`, `expertlaw`, `expertpages`, `expertwitness_com`, `other_expert_directories`, `expert_website`, `ime_websites`, `advertising`, `ime_advertising`, `other_public_websites`, `youtube`, `presentations`, `powerpoints`, `patient_reviews`, `google_maps`, `corporate_affiliations`, `university`, `state_court_records`, `patents`, `trademarks`, `awards`, `military_claims`, `university_accreditation`, `depositions`, `expert_testimony`, `motions`, `orders`, `pleadings`. — [source-kind.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/source-kind.ts)
- `withWebResearch()` rewrites those catalog rows to `liveImplemented: true`, `accessClass: 'public'`, and a summary that public search “finds and reads” those labels through Gemini grounding / news indexes / Serper / Brave / Tavily. Login, CAPTCHA, robots.txt, and paywall pages are listed as not read. — [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts)
- Default search-provider list: `WEB_SEARCH_PROVIDERS=gemini_grounding,serper,brave,tavily,google_news_rss,gdelt`. Only configured keys run. Caps: `WEB_SEARCH_MAX_QUERIES` default 64, `WEB_SEARCH_MAX_PAGES` 150, `WEB_FETCH_MAX_PAGES` 80, `WEB_RESEARCH_DEADLINE_MS` default 180000 (clamped 60s–240s). — [research.config.ts](file:///d:/medical-causation-ai/apps/api/src/config/research.config.ts)
- `query-planner.ts` plans topical queries including identity, portrait, directories (DRI speaker + extra hosts), per-platform social `site:` queries, IME, patents, awards, military claims, court documents, depositions, criminal-news terms, CHEA/USDE follow-ups, and certification/education/license. High-value topics paginate on Serper/Brave. Budget drops lower-priority topics first; omitted topics are recorded. — [query-planner.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/query-planner.ts)
- `ExpertResearchService.collectProviders()` runs every requested id, applies `applyIdentityMatch` then `applyPublicEvidenceGate`, optionally `MediaTranscriptionEnricher` (AssemblyAI: at most 2 direct public mp3/mp4 files, YouTube watch URLs never submitted), then `markConflicts`. — [expert-research.service.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/expert-research.service.ts)
- Investigation stages (`EWI_WORKFLOW_STAGES`, 27 stages) include every catalog provider exactly once (`assertResearchPlanCoversCatalog`). Research stages call `collectProviders` for that stage’s ids. Uncertain identity items are **not** merged into `evidence`. Later stages build legal / presence / professional dossiers, CV check, questions, and the PDF. — [investigation-stages.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/investigation/workflow/investigation-stages.ts); [investigation-workflow.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/investigation/workflow/investigation-workflow.ts)
- CV path: uploaded CV is OCR’d and claim-extracted (`expert-cv.service.ts` / `cv-claims.ts`), then `compareCv()` in the discrepancies stage. Publication titles (up to 25) go through `PublicationTitleLookup` (OpenAlex + PubMed + Crossref + optional ORCID) **only in live mode**; outside live every citation returns `unavailable`. Licenses/specialty/payments compare only when NPI identity is confirmed. — [cv-comparison.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/cv/cv-comparison.ts); [expert-research.service.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/expert-research.service.ts)
- Crossref is **not** a live catalog adapter. `createPublicationLookup()` wires `CrossrefClient` into CV title lookup only. Catalog row `crossref` still falls through to `CatalogExpertResearchProvider` (“live adapter is not connected”). — [expert-research.service.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/expert-research.service.ts); [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts)
- Report builder `buildEwiReportDocument()` fills 41 sections (`EWI_REPORT_SECTIONS`). Template id `ewi/investigation-report`, version **3.10.7**. Web pages are refiled by `routeWebFindings()`. Cover highlight includes “Cross-examination questions omitted” (since 3.10.4). Separate source-links PDF groups subject / possible / other-person URLs (`ewi-source-links.ts`). — [ewi-report.template.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-report.template.ts); [ewi-report.version.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-report.version.ts); [ewi-source-links.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-source-links.ts)
- `CatalogExpertResearchProvider` in live mode: restricted sources get “No request was sent”; non-free_api/non-manual get “requires authorized access”; otherwise “live adapter is not connected.” Nothing is invented. — [catalog-expert-research.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/catalog-expert-research.provider.ts)
- CHANGELOG 26 Oct 2026 states reports 3.10.2–3.10.7 are **not deployed**; historic client PDFs were not overwritten. — [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)

### Inferences
- A completed live investigation **does** walk the full 41-section outline and **does** invoke every catalog id. That is why the PDF looks complete even when most sections have no issuing-body result.
- “Web-backed” is not “the named product ran.” `seak` live-path = public `site:seakexperts.com` / incidental hits, not a SEAK API. `google_maps` live-path = search snippets whose URL classifies as maps, not Maps Platform. `patents` live-path = Google Patents / uspto.gov web queries, not USPTO Open Data Portal. `depositions` live-path = public mentions, not TrialSmith transcripts.
- Dedicated adapters that share `ExpertIdentityResolver` (NPI, Open Payments, OpenAlex, CourtListener, Florida MQA) are stricter than the web layer. PubMed, Justia, ORCID, YouTube, and NIH RePORTER do **not** take that shared NPI record as a search key.

### Gaps
- This research did not inspect a live job log, so it cannot state which search providers were configured on any laptop or droplet at runtime.
- `DEPLOYMENT.md` still says `ASSEMBLYAI_API_KEY` is stored but not used; code and CHANGELOG 3.10.0 contradict that. The live server `.env` was not read.

## Which report sections stay empty, uncertain, or contaminated by same-name hits, CAPTCHA, robots, login walls, or unread snippets?

### Takeaway
Empty or “unable to verify” sections are usually **honest coverage of missing issuing-body adapters**, not a failed search. Contamination and unread snippets are a different failure: web/Justia/CourtListener hits that look like findings. Template 3.10.6–3.10.7 added gates against surname-only and court-as-credential misfile; those gates are in this workspace’s code and are documented as not yet on historic client PDFs.

### Cited Findings

**Report section map (what the PDF/on-screen report claims to cover)**

| # | Section id | Title |
|---|---|---|
| 1–5 | `expert-name`, `city`, `specialty`, `investigation-date`, `summary` | Cover facts + Executive Summary |
| 6 | `background` | Expert Background (NPI identity; unconfirmed NPI items filtered out) |
| 7 | `inconsistencies` | Inconsistencies in Background |
| 8 | `cv-comparison` | CV Comparison |
| 9–14 | `education`, `university-accreditation`, `licenses`, `board-actions`, `board-certifications`, `certification-orgs` | Credentials |
| 15–19 | `memberships`, `publications`, `grants`, `patents`, `awards-military` | Scholarship / honors |
| 20–22 | `websites`, `ime`, `directories` | Presence / ads / directories |
| 23–27 | `orders`, `pleadings`, `depositions`, `testimony-inconsistencies`, `admissibility-challenges` | Legal dossier |
| 28–30 | `income-bias`, `lawsuits`, `criminal` | Money / suits / crime |
| 31–37 | `social`, `videos`, `news`, `university-rules`, `corporate`, `patient-reviews`, `office-location` | Presence / reviews / location |
| 38–41 | `misc`, `web-research`, `overall-findings`, `source-index` | Catch-all, same-name people, findings, source index |

— [ewi-report.template.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-report.template.ts)

**Empty / not independently verified (architecture, not a live run)**

- Generic empty copy: “Nothing in this section was confirmed from the sources and pages retrieved. This is not proof that nothing exists…” (`EMPTY`). Credential claims without an issuing-body hit are labelled stated-on-page, not confirmed. — [ewi-report.template.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-report.template.ts)
- `education_verification` and `board_certification` / `certification_organization` are **not** in `WEB_RESEARCH_SOURCE_IDS`. Their stage still runs; the catalog stub returns “live adapter is not connected.” Web *claims* can still land in Education / Board Certifications via `routeWebFindings`, but 3.10.4 says a strong own-site/directory match is **not** independent verification. — [investigation-stages.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/investigation/workflow/investigation-stages.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Florida MQA (`state_license` / `state_discipline`) runs only when city state is `FL` or NPPES lists a Florida license number. Other states: “Official board not accessed.” A blocked MQA page is `outcome: 'restricted'`, not an invalid license. — [florida-license.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/florida-license.provider.ts)
- Open Payments is skipped entirely without a confirmed NPI, so section 28 can be empty for an otherwise well-known expert. — [open-payments.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/open-payments.provider.ts)
- Criminal (`criminal_records`) and malpractice (`malpractice_records`) catalog adapters never send a request. Query planner still runs a public-web criminal-news query; 3.10.7 says public web search must not be described as a comprehensive malpractice or criminal search. — [catalog-expert-research.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/catalog-expert-research.provider.ts); [query-planner.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/query-planner.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Memberships catalog ids `memberships` and `professional_organizations` are **not** web-backed; possible memberships from web claims stay listed separately and must not be called verified (3.10.7). — [source-kind.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/source-kind.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Depositions section: docket notices that mention a deposition are not transcripts (3.10.7). `depositions` web source is mentions, not TrialSmith. — [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Videos: YouTube Data API stores caption-exists flag but does not download captions. AssemblyAI transcribes at most two direct public media files; YouTube watch URLs are never submitted. Without `YOUTUBE_API_KEY`, the `youtube` id is web `site:youtube.com` / vimeo. — [live-sources.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/live-sources.ts); [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts)
- Social: Facebook, Instagram, LinkedIn, X, TikTok classified `loginGated: true` and never fetched; only search-listing URLs. Bluesky is not gated. — [source-kind.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/source-kind.ts); [web-research-engine.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/web-research-engine.ts)
- CV comparison without an uploaded CV: report must say comparison was **not performed**, not that there are no discrepancies (3.10.7). Unconfirmed NPI → specialty/license/payment rows are `unable_to_verify`. A catalog title miss is unable-to-verify, not a discrepancy (3.10.6). — [cv-comparison.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/cv/cv-comparison.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Generated cross-examination questions are omitted from PDF/Word as of 3.10.4 (`highlights` includes “Cross-examination questions omitted”). — [ewi-report.template.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-report.template.ts)

**Unread / blocked / CAPTCHA / robots**

- Web engine limitations explicitly count pages not read because of “login, CAPTCHA/bot protection, robots.txt, or paywall”; they are listed by address only and never bypassed. — [web-research-engine.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/web-research-engine.ts)
- `isBlockedChallengeTitle()` rejects titles such as “Just a moment”, “Attention required”, “CAPTCHA”, Cloudflare challenges so they are not used as findings. 3.10.6: CAPTCHA challenge text is not used as a title. — [source-kind.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/source-kind.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Justia: `justiaPageIsReadable()` fails on Cloudflare / “just a moment” / enable-JavaScript pages; unread is an error, not “no cases.” Last-name-in-link-text is the hit test (max 8 links). — [justia.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/justia.provider.ts)
- Florida MQA and Sunbiz are documented as commonly bot-walled; 403 is not treated as “no license / no entity.” Prices and Demery notes in provider-register dated **22 Oct 2026 — already stale**. — [provider-register.md](file:///d:/medical-causation-ai/docs/ewi/provider-register.md)
- `WebSourceProvider` emits blocked items with `ambiguous: true` so they cannot pass identity match into subject evidence. Unread count is in the source message. A dedicated topic that never ran is `skipped` (“not searched as a dedicated source”), not `no_result`. — [web-source-providers.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/web-source-providers.ts)
- Coverage labels: `searched_no_results`, `not_implemented`, `blocked_or_access_denied`, `not_configured`, `failed`, `skipped`. Empty `ok` with 0 items is **not** a completed search (`pending` / unavailable). Restricted catalogs that were never contacted are `not_implemented`, not blocked. — [research-outcome.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/research-outcome.ts)

**Same-name contamination (code gates vs historic reports)**

- Shared post-filter `assessIdentityMatch`: name must agree; city or specialty must also agree and must not contradict; `verifiedBy: 'npi' | 'source_match'` from a live adapter counts as matched; otherwise uncertain and not merged. — [identity-match.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/identity-match.ts)
- Web identity (`identity-assess.ts`): another first name with the same surname is another person; surname-only is never “possible” even with matching specialty/city; limited/snippet text is demoted from strong to possible. 3.10.6 cites Leah Ellenberg vs Leila Glass as the contamination example the gate targets. — [identity-assess.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/identity-assess.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Credential sections require `match.level === 'strong'`. Court-like pages cannot file `board_certification`, license, education, IME, advertising, deposition, or testimony **claims** (`TOPICS_NOT_FROM_COURT_CLAIMS` + `looksLikeCourtDocument`). Orders/motions still file by document type. — [section-router.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/section-router.ts)
- PubMed keeps articles on last name + initials only; “Affiliation is not confirmed from the summary alone.” Same-name authors remain a contamination path into Publications. — [pubmed.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/pubmed.provider.ts); [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts)
- CourtListener: opinions need full name + specialty term; NPI-confirmed RECAP may omit the specialty word but then identity stays unverified unless a credential/specialty/place marker is on the filing (3.10.0/3.10.1). Expert role is never assumed. Excerpts that do not name the expert stay uncertain (3.10.7). — [courtlistener.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/courtlistener.provider.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Historic Demery Word (9) (inspected in capability-audit **22 Oct 2026**, template 3.9.2): Justia URL filed as “Board certification”; PACER `show_public_doc` unread snippet reused in IME, pleadings, testimony; ResearchGate as publications/expert website; city “Not provided”; 20 items, 0 inconsistencies, 18 questions. That file was **not regenerated** after routing fixes. — [capability-audit.md](file:///d:/medical-causation-ai/docs/ewi/capability-audit.md)
- Live PDF job `192fdaa2` is frozen at template 3.9.0 and must not be overwritten (docs/ewi README). — [docs/ewi/README.md](file:///d:/medical-causation-ai/docs/ewi/README.md)

### Inferences
- After many audits the report still “lacks proper results” for two concurrent reasons: (1) credential/legal/deposition sections cannot be filled by public search at issuing-body depth; (2) historic client artifacts still show 3.9.x contamination that 3.10.6–3.10.7 tried to stop in code that CHANGELOG says is not deployed.
- Unread snippets remain first-class evidence objects (they have URLs and titles). Even with better wording, a source-index full of “not read” PACER/Justia/Sunbiz/LinkedIn lines looks like a thin investigation.
- PubMed initials matching and Justia last-name-in-link matching are the remaining dedicated-adapter same-name holes that identity-assess does not fully close, because those adapters set their own `raw.identity` and can mark `source_match`.

### Gaps
- No live 3.10.7 PDF was generated in this research, so remaining contamination after 3.10.6–3.10.7 is inferred from tests and CHANGELOG, not from a new client report.
- Demery Word (9) defects are a 22 Oct 2026 baseline; they do not describe current live output.

## What is catalog-only and never called (Lexis, SEAK, DRI, USPTO, PACER recap-fetch, TrialSmith, Westlaw, FSMB, criminal/malpractice aggregators)?

### Takeaway
Do not treat “never called” as one bucket. Named commercial APIs for Lexis, USPTO ODP, Maps, criminal/malpractice aggregators, and directory keys are unread env names. SEAK/DRI **are** invoked as public-web catalog ids. PACER recap-fetch, Westlaw, FSMB, and TrialSmith ingest are **not in the live adapter map at all**.

### Cited Findings

**Dedicated adapter exists and is invoked in live path**

NPI Registry, Open Payments, OpenAlex, PubMed, NIH RePORTER, ORCID, CourtListener, Justia, Florida MQA license + discipline, YouTube Data API v3 **if** `YOUTUBE_API_KEY` is set. Crossref client on CV lookup only. AssemblyAI enricher when keyed and a direct media file is found. Web engine when Gemini/Serper/Brave/Tavily/news feeds are configured. — [live-sources.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/live-sources.ts); [client-provider-assessment.md](file:///d:/medical-causation-ai/docs/ewi/client-provider-assessment.md) (code-path check dated 26 Oct 2026)

**Catalog id invoked, but only as public web (named API never used)**

| Catalog id | What actually runs | Named key |
|---|---|---|
| `seak`, `dri`, `alm_law`, `jurispro`, `expertlaw`, `expertpages`, `expertwitness_com`, `expert_directory`, `other_expert_directories` | `WebSourceProvider`; dedicated directory only if that host appeared in a query or result (`DEDICATED_DIRECTORY_HOSTS`). Generic “directories” topic is **not** a SEAK search. | `SEAK_API_KEY`, `DRI_API_KEY`, `ALM_API_KEY`, `JURISPRO_API_KEY`, etc. unread |
| `patents`, `trademarks` | Web queries (Google Patents / uspto.gov / WIPO hosts in `recordServesCatalogSource`) | `USPTO_API_KEY` unread; no ODP client |
| `google_maps` | URL classification of maps hosts | `GOOGLE_MAPS_API_KEY` unread |
| `depositions`, `expert_testimony`, `motions`, `orders`, `pleadings` | Web mentions + CourtListener/Justia overlap | No TrialSmith/Lexis/PACER fetch |
| `university_accreditation` | Web; CHEA/USDE count as dedicated only if `chea.org` / `ope.ed.gov` appear | No CHEA API |
| `awards`, `military_claims` | Web; `valor.defense.gov` classified military | No NPRC |
| `social`, `news`, `blogs`, `ime_*`, `advertising`, `patient_reviews`, `corporate_affiliations` | Web engine | Login/paywall not bypassed; Sunbiz often 403 |

— [web-source-providers.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/web-source-providers.ts); [source-kind.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/source-kind.ts); [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts)

**Catalog id invoked as stub — no network, “No request was sent”**

- `lexisnexis`: `accessClass: 'restricted'`; extra message “LexisNexis PDFs are not stored.” `LEXISNEXIS_API_KEY` unread. — [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts); [catalog-expert-research.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/catalog-expert-research.provider.ts)
- `criminal_records`, `malpractice_records`: restricted stubs. `CRIMINAL_RECORDS_API_KEY`, `MALPRACTICE_RECORDS_API_KEY` unread. Public-evidence gate additionally requires identity match + a public source statement; weak flags (`similarName`, event attendance, etc.) never record. — [public-affiliation.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/public-affiliation.ts)
- `cv_profile`, `education_verification`, `board_certification`, `certification_organization`, `author_verification`, `lead_author_verification`, `crossref` (catalog row), `grant_results`, `memberships`, `professional_organizations`, `constitutional_sheriff`, `post_records`, `oath_keepers`: live adapter “not connected” (or restricted/manual as cataloged). User-supplied CV is a **different** path (`readCv` in workflow), not `cv_profile` network.

**Not a catalog provider — never constructed**

- **Westlaw**: not in `EXPERT_RESEARCH_CATALOG`. Appears only as a restricted storage hostname / `RESTRICTED_SOURCE_PROVIDERS` alongside Lexis. — [investigation-lifecycle.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/investigation/domain/investigation-lifecycle.ts); [document-storage-policy.util.ts](file:///d:/medical-causation-ai/apps/api/src/modules/document-processing/utils/document-storage-policy.util.ts)
- **FSMB**: grep of the repo finds the string only in `TODO.md` pending paid sources. No catalog id, no adapter, no web host list.
- **PACER recap-fetch**: CourtListener adapter uses public REST + optional token for excerpts; recap-fetch (client PACER credentials, per-page fees) is documented as **not coded**. — [provider-register.md](file:///d:/medical-causation-ai/docs/ewi/provider-register.md); [client-provider-assessment.md](file:///d:/medical-causation-ai/docs/ewi/client-provider-assessment.md)
- **TrialSmith ingest**: no catalog id. `trialsmith.com` is one of many `other_expert_directories` domains. Outreach template exists but `EWI_REQUEST_TRIALSMITH_ENABLED` defaults false. Docs: no public API; license forbids building a competing database. Download prices **$28–$50** quoted 22 Oct 2026 — **already stale**. — [ewi-request.config.ts](file:///d:/medical-causation-ai/apps/api/src/config/ewi-request.config.ts); [provider-register.md](file:///d:/medical-causation-ai/docs/ewi/provider-register.md)
- Reserved unread keys listed in capability-audit: `USPTO_API_KEY`, `LEXISNEXIS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `CRIMINAL_RECORDS_API_KEY`, `MALPRACTICE_RECORDS_API_KEY`, directory keys, `WEB_SEARCH_API_KEY`. Setting them does nothing. — [capability-audit.md](file:///d:/medical-causation-ai/docs/ewi/capability-audit.md)

**Catalog comment that is now misleading**

- Base catalog text for `patents` still says “Not called locally.” `withWebResearch()` overwrites that summary because `patents` is in `WEB_RESEARCH_SOURCE_IDS`. USPTO ODP remains uncalled. — [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts)

### Inferences
- Attorneys reading section titles “Expert Directories,” “Depositions,” “Patents,” or “Criminal Records” will think those platforms ran. Coverage notes try to say otherwise; historic 3.9.x reports mixed “not implemented” with snippet reuse.
- Buying a SEAK/DRI **subscription** would not automatically populate those sections; there is no adapter to consume a licensed API or export. Engineering would still have to add an authorized ingest path.
- FSMB (Federation of State Medical Boards) is a real credential gap for multi-state licenses and discipline, and it is absent from the catalog entirely—unlike Lexis, which at least has a never-sent stub.

### Gaps
- Whether any directory public homepage is actually reachable without login was not re-tested here.
- TrialSmith/Lexis/Westlaw current contract prices are unknown; 22 Oct 2026 quotes are stale.

## How identity confirmation works (NPI, name/city/specialty) and how that blocks or pollutes credentials, publications, courts, IME ads, and source-links?

### Takeaway
Identity is a two-speed system. NPI confirmation is strict and **blocks** Open Payments and Florida-tied license merge; it does **not** block PubMed/Justia/web search. Web identity is looser (name + city or specialty) and is the main pollution path into credentials, IME ads, and source-links unless 3.10.6 strong-match and court-routing gates hold.

### Cited Findings
- `ExpertIdentityResolver` (shared, 30-minute cache): if the attorney supplies an NPI, load that record; name must match or status is `npi_mismatch` and nothing is attributed. Organization (NPI-2) records are rejected. City mismatch is a note, not a veto, when NPI was supplied. Taxonomy mismatch is a note (“self-reported, not board certification”). — [identity-resolver.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/identity-resolver.ts)
- Without a supplied NPI: search name (+ city/state variants, including “St. Louis” vs “SAINT LOUIS”), require exactly one record matching name and (if given) city and comparable specialty. Zero → `not_found`. Several → `ambiguous` with up to 10 candidates, **not merged**. Name alone without city and without comparable specialty never collapses to one person. Same name+specialty in another city stays possible, not confirmed (3.10.3). — [identity-resolver.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/identity-resolver.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- `NpiRegistryResearchProvider` emits identity + self-reported licenses only when confirmed. Background section filters `npi_registry` items unless `identity.status === 'confirmed'`. — [npi-registry.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/npi-registry.provider.ts); [ewi-report.template.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-report.template.ts)
- **Blocked by unconfirmed NPI:** Open Payments (not searched). CV specialty/license/payment comparison (`confirmed()`). Official Florida lookup still *can* run from city=FL or NPPES FL number, but NPPES numbers are a search hint only. — [open-payments.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/open-payments.provider.ts); [cv-comparison.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/cv/cv-comparison.ts); [florida-license.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/florida-license.provider.ts)
- **Not blocked by unconfirmed NPI:** PubMed (name/initials), Justia (full name / last name in link), NIH RePORTER (investigator name; org must also fit), ORCID (name insufficient; affiliation/specialty/iD/publication id required), YouTube (first+last plus specialty or place per catalog summary), entire web engine. CourtListener still searches; NPI-confirmed RECAP is more permissive on specialty-word drop. — [pubmed.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/pubmed.provider.ts); [justia.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/justia.provider.ts); [provider-catalog.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/providers/provider-catalog.ts)
- OpenAlex: name + research topics + institution geography; 3.10.5 allows a unique name-and-specialty profile when institution geography is missing, but still rejects another country. Location is not claimed unless the profile listed it. — [openalex.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/openalex.provider.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Workflow evidence list **drops** `identityMatch === 'uncertain'` items so they do not feed inconsistencies, questions, or most section bodies. They can still appear in “Other People with This Name” (section 39) and in source-links “Possible matches” / “Other people.” — [investigation-workflow.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/investigation/workflow/investigation-workflow.ts); [ewi-source-links.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-source-links.ts)
- Source-links (3.10.7): subject URLs = strong identity, confirmed NPI, or attributed evidence. Possible matches are not treated as credentials. A URL is not proof the page was read. Access labels distinguish search snippet, docket metadata, and read page content. — [ewi-source-links.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-source-links.ts); [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- IME ads: directory/practice pages that advertise IME or forensic services file under IME advertising (3.10.2). Court/Justia pages are not IME unless the text is a claim against the expert (3.10.6). Historic Word (9) had PACER snippets misfiled as IME. — [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md); [capability-audit.md](file:///d:/medical-causation-ai/docs/ewi/capability-audit.md)
- Intake without a city (Demery Word (9) “Not provided”) makes NPI confirmation fail the single-record city test and leaves Open Payments + license verification empty while web/PubMed still run—maximizing same-name noise. — [identity-resolver.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/identity-resolver.ts); [capability-audit.md](file:///d:/medical-causation-ai/docs/ewi/capability-audit.md)

### Inferences
- Asking the attorney for NPI + city is the highest-leverage **process** fix already implemented in code: it unlocks Open Payments and tightens CourtListener RECAP, and it stops NPPES licenses being copied as verified from the wrong city.
- Identity gates cannot create board-certification or deposition facts. They can only prevent wrong-person facts. Empty credential sections after a confirmed NPI are still empty because ABMS/ABPP/FSMB/state boards other than Florida MQA are not connected.
- Source-links PDF can look “rich” (many URLs) while the subject cluster is small; that is by design after 3.10.7 and can still disappoint if the reader treats every URL as a read, on-point source.

### Gaps
- Live behavior when specialty is too generic for taxonomy comparison was read in code (`specialtyStems` empty → specialty not used) but not exercised against a named expert.

## What the existing docs already concluded (docs/ewi/*.md, docs/ewi-workflow.md, TODO.md) and whether those conclusions still match the code as of the current workspace?

### Takeaway
`docs/ewi/client-provider-assessment.md` (26 Oct 2026) still matches the live-path wiring. Older narrative docs (`docs/ewi-workflow.md`, `TODO.md` intro, capability-audit patents row, integration-plan USPTO “not started” for web patents, cost-estimate “transcription not implemented”) are **stale relative to this workspace’s 3.10.2–3.10.7 code**. CHANGELOG’s “not deployed” note means production reports may still match the stale docs.

### Cited Findings
- **Still true in code:** catalog row ≠ runtime; reserved keys unread; Lexis never sent; recap-fetch not coded; TrialSmith/Westlaw/FSMB not ingested; Florida MQA only; NPPES licenses self-reported; CourtListener ≠ complete docket; YouTube captions not downloaded; no paywall bypass; historic PDF `192fdaa2` frozen; prices in provider-register dated **22 Oct 2026 — already stale**. — [capability-audit.md](file:///d:/medical-causation-ai/docs/ewi/capability-audit.md); [client-provider-assessment.md](file:///d:/medical-causation-ai/docs/ewi/client-provider-assessment.md); [live-sources.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/live-sources.ts)
- **Stale — docs/ewi-workflow.md** still says live mode connects **four** free sources (NPI, Open Payments, OpenAlex, CourtListener) and “every other source still returns `unavailable`.” Code also runs PubMed, NIH RePORTER, ORCID, Justia, Florida MQA, optional YouTube, and the web engine for 35 catalog ids. — [ewi-workflow.md](file:///d:/medical-causation-ai/docs/ewi-workflow.md)
- **Stale — TODO.md** line “EWI runs … on four free public sources” and checkbox that only names those four as live. The pending bullet correctly notes public-web coverage 3.10.2–3.10.5 was added 26 Oct 2026 **but was not deployed**, and still lists PACER, Lexis/Westlaw, TrialSmith, FSMB, USPTO after ID.me as unpaid gaps. — [TODO.md](file:///d:/medical-causation-ai/TODO.md)
- **Partially stale — capability-audit.md (22 Oct 2026):** dedicated-adapter table is still right. Web table and “patents/trademarks Not called” are wrong after 3.10.2 (`patents` is web-backed). Demery Word (9) defects remain a valid **historic** baseline, not a current-code screenshot. “Twenty-five” web ids is short of the current 35. — [capability-audit.md](file:///d:/medical-causation-ai/docs/ewi/capability-audit.md); [source-kind.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/source-kind.ts)
- **Partially stale — integration-plan.md (22 Oct 2026):** P0 court-not-credential routing is in `section-router.ts`. P1 YouTube metadata is in code. P1 USPTO ODP adapter still not started (correct). P1 “manual STT flag default false” is stale: `EWI_TRANSCRIPTION_ENABLED` default is **true** with a 2-file/30-min cap. Web patents/IME/DRI searches **did** start in 3.10.2 without ODP. — [integration-plan.md](file:///d:/medical-causation-ai/docs/ewi/integration-plan.md); [research.config.ts](file:///d:/medical-causation-ai/apps/api/src/config/research.config.ts)
- **Partially stale — investigation-cost-estimate.md:** Scenario 1 “Transcription: Not implemented” and “Videos discovered today: 0 without YouTube API” do not match AssemblyAI enricher + YouTube adapter. PACER/TrialSmith/Lexis exclusions still match code. Dollar figures dated **22 Oct 2026 — already stale**. — [investigation-cost-estimate.md](file:///d:/medical-causation-ai/docs/ewi/investigation-cost-estimate.md)
- **Most current docs:** CHANGELOG 3.10.0–3.10.7 (23–26 Oct 2026) plus client-provider-assessment (26 Oct 2026). Template comments in `ewi-report.version.ts` match those changelog bullets. — [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md); [ewi-report.version.ts](file:///d:/medical-causation-ai/apps/api/src/modules/ewi/report/ewi-report.version.ts)
- **README.md** (product) is closer to code than ewi-workflow: it lists NPI, Open Payments, OpenAlex, CourtListener, PubMed, NIH RePORTER “and others,” optional YouTube and Serper, paid legal DBs not connected. — [README.md](file:///d:/medical-causation-ai/README.md)

### Inferences
- Repeated audits keep rediscovering the same paid-source holes because the **product surface** (41 sections, catalog names, stage labels) was built as a full expert-witness checklist, while the **live path** was built as public APIs + scrape-never web search. Docs that say “four sources” understate today’s web layer; docs that list SEAK/DRI as live overstate it if the reader hears “SEAK API.”
- Deploy lag is a first-class cause of “audits didn’t fix reports”: code 3.10.7 vs frozen 3.9.0 PDF and Word (9). Regenerating historic jobs is explicitly blocked.

### Gaps
- Droplet/production template version was not inspected (no live job, no server `.env`).
- `docs/how-it-works.md` and `DEPLOYMENT.md` still mention the four-source live story and unused AssemblyAI; not fully re-read line-by-line beyond grep.

## What would most improve report quality if the firm paid for sources vs if engineering only improved scraping/identity?

### Takeaway
Paid sources buy **depth that public search cannot legally or technically obtain** (full federal filings, depositions, multi-state licenses, board certs, NPDB). Engineering-only work buys **honesty and less wrong-person noise** on the public layer, and is largely already in 3.10.x waiting on deploy + better intake (NPI/city). Scraping harder cannot replace ABPP, PACER, or TrialSmith.

### Cited Findings

**Engineering-only (no new paid vendors) — already in code or listed as next unpaid steps**

- Deploy 3.10.2–3.10.7 so client PDFs stop showing 3.9.x court-as-board-cert and PACER-as-IME. CHANGELOG: not deployed; historic reports not overwritten. — [CHANGELOG.md](file:///d:/medical-causation-ai/CHANGELOG.md)
- Require NPI and city on intake when possible; identity-resolver already uses them. Missing city was a documented Demery failure mode. — [identity-resolver.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/identity-resolver.ts); [capability-audit.md](file:///d:/medical-causation-ai/docs/ewi/capability-audit.md)
- Tighten PubMed (affiliation/institution, not initials only) and Justia (not last-name-only links). These are dedicated-adapter holes. — [pubmed.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/pubmed.provider.ts); [justia.provider.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/expert-research/live/justia.provider.ts)
- Official-host routing for ABPP/AACN (integration-plan P1 “next unpaid code step”); AACN directory ≠ ABPP certificate already encoded in `section-router.ts`. — [integration-plan.md](file:///d:/medical-causation-ai/docs/ewi/integration-plan.md); [section-router.ts](file:///d:/medical-causation-ai/apps/api/src/integrations/web-research/section-router.ts)
- Use more of CourtListener’s **already-public** text fields (P2, $0, recap-fetch off). — [integration-plan.md](file:///d:/medical-causation-ai/docs/ewi/integration-plan.md)
- YouTube Data API key (free quota) for real video ids vs `site:youtube` luck; still no third-party captions. — [provider-register.md](file:///d:/medical-causation-ai/docs/ewi/provider-register.md)
- USPTO ODP: list price $0 but **ID.me** identity verification for the key holder; not a scrape improvement. — [client-provider-assessment.md](file:///d:/medical-causation-ai/docs/ewi/client-provider-assessment.md)
- Rejected by project rules: YouTube timedtext scrape, MQA/Sunbiz/LinkedIn bot-wall defeat, cheap criminal aggregators. — [provider-register.md](file:///d:/medical-causation-ai/docs/ewi/provider-register.md); [docs/ewi/README.md](file:///d:/medical-causation-ai/docs/ewi/README.md)

**If the firm pays — highest report-section impact (from existing plan, not a new live test)**

| Gap in the 41-section report | Paid / licensed path | Why scraping will not close it | Cost note (22 Oct 2026 — already stale) |
|---|---|---|---|
| 23–24 Orders / Pleadings (full text, not snippet) | PACER via CourtListener recap-fetch, flag default false, per-job budget | PACER `show_public_doc` unread; CL API is free, **PACER still bills** | $0.10/page, $3/doc cap except transcripts; $30/quarter waiver; 2027 $0.12 / $40 |
| 25 Depositions / 26 Testimony | TrialSmith (plaintiff-lawyer membership) or Lexis plan that includes transcripts | No public API; license forbids competing DB; docket “deposition” ≠ transcript | TrialSmith downloads $28–$50; membership quote |
| 13 Board certifications | Manual/staff ABPP (and similar board) verify; no verification API found | Own-site “board certified” is not ABPP.org | Staff time; $0 lookup |
| 11–12 Licenses / board actions outside Florida | Per-state board or **FSMB** (not in catalog) | Florida MQA only; other states “official board not accessed”; NPPES is self-report | Varies; FSMB not specified in code |
| 29 Lawsuits/Malpractice as NPDB | NPDB is restricted; do not use cheap aggregators | Public opinions ≠ NPDB | Quote / reject mills |
| 30 Criminal | Authorized vendor only; docs recommend **reject** cheap APIs | Web “arrested OR conviction” query is news, not a background check | Quote |
| 32 Video transcripts | Lawful file ingest + STT (AssemblyAI already wired, cap 2×30 min) | `captions.download` is owner-only | AssemblyAI ~$0.21/hr batch (~$0.11 at cap) — stale |
| 18 Patents as inventor-official | USPTO ODP after ID.me | Web patents ≠ ODP documents | $0 API after identity proof |
| 22 Directories as member records | SEAK/DRI/ALM licensed export | Login pages not fetched; `site:` ≠ member database | Subscription quote |

— [integration-plan.md](file:///d:/medical-causation-ai/docs/ewi/integration-plan.md); [provider-register.md](file:///d:/medical-causation-ai/docs/ewi/provider-register.md); [investigation-cost-estimate.md](file:///d:/medical-causation-ai/docs/ewi/investigation-cost-estimate.md); [TODO.md](file:///d:/medical-causation-ai/TODO.md)

- Integration-plan stop rule: do not approve PACER, TrialSmith, Lexis, or STT until identity/routing quality and a budget are explicit. Do not silently fail over from free to paid. — [integration-plan.md](file:///d:/medical-causation-ai/docs/ewi/integration-plan.md)
- Scenario 1 public-path variable cost in the 22 Oct 2026 estimate was roughly $0–$2.34/investigation under Gemini/Serper/Brave (stale). That spend does **not** close board certs, depositions, other-state licenses, or paid PACER text. — [investigation-cost-estimate.md](file:///d:/medical-causation-ai/docs/ewi/investigation-cost-estimate.md)

### Inferences
- Ranked impact if the product’s users are Florida PI lawyers attacking opposing medical experts:
  1. **Deploy current report code** + NPI/city intake (engineering, $0 vendors).
  2. **PACER recap-fetch with a hard cap** — fills the sections attorneys actually cite (motions/orders) that today are unread RECAP/PACER URLs.
  3. **Issuing-body credentials** — Florida MQA when readable plus staff ABPP/FSMB/other-state licenses; this is the hole the 41-section outline advertises and public web cannot certify.
  4. **TrialSmith/Lexis** only if deposition impeachment is a frequent need; there is no adapter-shaped API, so this is process + licensed human retrieval, not a weekend scrape.
- Engineering-only scraping of more pages will increase snippet count and CAPTCHA failures faster than it increases verified credentials. The web deadline (3 minutes default) already omits topics; raising fetch caps without identity/official-host rules would likely **worsen** contamination.
- Paying for Gemini/Serper/Brave overage improves **discovery**, not **verification**. Discovery is not the main remaining complaint once 3.10.x public-web topics already include patents, DRI, IME, awards, and CHEA.

### Gaps
- No firm-specific volume (investigations/month) was available, so amortized Lexis/Westlaw/TrialSmith seat cost cannot be computed.
- Whether Florida MQA is readable from the deployment IP (vs laptop) was not tested; docs say bot walls are common.
- ABMS/ABPP paid verification products were marked “unverified quote” in provider-register (22 Oct 2026) and were not re-priced.
