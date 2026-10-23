# EWI capability audit — what actually works

**Date:** 22 October 2026  
**Branch:** `fix/ewi-report-rebuild-captions-questions` (HEAD `6015b85` plus uncommitted 3.9.2 work)  
**Baseline report:** `ewi-jason-a-demery-report (9).docx` (Word export, Report 3.9.2, generated 22 Oct 2026 12:42 UTC)  
**Live PDF (do not overwrite):** job `192fdaa2-2c1d-4477-a1ff-9c81b2cf65e9`, template 3.9.0  
**Historic job (do not alter):** `9a1823db-f412-4f7d-ad2c-45d1a30a1881`

This audit does **not** infer runtime support from an enum, catalog row, `.env.example` reserved key, or documentation claim. A source is “working” only when a dedicated adapter or the shared web engine is registered in `createLiveSourceProviders` / `createWebSourceProviders` and is invoked when `RESEARCH_PROVIDER=live`.

## How live mode is wired

| Layer | What it does |
|---|---|
| Catalog | `EXPERT_RESEARCH_CATALOG` in `provider-catalog.ts`. `liveImplemented` is **not** proof of a dedicated API. |
| Dedicated live adapters | `createLiveSourceProviders` in `live-sources.ts`. Ten always-on adapters (NPI, Open Payments, OpenAlex, Justia, PubMed, NIH RePORTER, ORCID, CourtListener, Florida license, Florida discipline) plus YouTube Data API v3 when `YOUTUBE_API_KEY` is set. |
| Web-backed catalog IDs | `WEB_RESEARCH_SOURCE_IDS` in `source-kind.ts`. Twenty-five IDs share `WebResearchEngine`. `withWebResearch()` marks those catalog rows `liveImplemented: true` even when the named API key is unused. |
| Search providers | `WEB_SEARCH_PROVIDERS` default `gemini_grounding,serper,brave,tavily,google_news_rss,gdelt`. Only configured keys are called. |
| Query planner | `query-planner.ts`. Per-platform social `site:` queries, DRI speaker queries, CV/first-author, extra directories, CHEA/USDE follow-ups. Serper/Brave page 2 on high-value topics. The `youtube` catalog id uses YouTube Data API v3 when a key is set. |
| Identity | Shared `ExpertIdentityResolver` via NPI. Name-only web hits stay possible matches. |
| CV compare | `cv-comparison.ts` plus `publication-lookup.ts` (OpenAlex, Crossref, PubMed, ORCID). Missing catalogue hit is “not found,” not proof the CV is false. |
| Questions | `ewi-report-questions.ts` plus stored drafts merged in `ewi-report-input.ts`. |
| Report | Template 3.9.2 rebuilds the legal dossier from evidence; coverage notes distinguish `searched_no_results`, `not_implemented`, and `blocked_or_access_denied`. |

Reserved keys that the API **does not read:** `USPTO_API_KEY`, `LEXISNEXIS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `CRIMINAL_RECORDS_API_KEY`, `MALPRACTICE_RECORDS_API_KEY`, directory keys, `WEB_SEARCH_API_KEY`. Setting them does nothing. `YOUTUBE_API_KEY` is read: when set, live mode uses YouTube Data API v3 for the `youtube` catalog id; without it, video discovery stays on the web layer. `ASSEMBLYAI_API_KEY` transcribes at most two direct public media files when `EWI_TRANSCRIPTION_ENABLED` is true (default). YouTube watch URLs are never submitted.

## Dedicated adapters (runtime)

| Catalog ID | Called at runtime | Access | What it actually returns | Independent verification | Missing |
|---|---|---|---|---|---|
| `npi_registry` | Yes — `NpiRegistryResearchProvider` | Free public CMS API | NPI, taxonomy, self-reported licenses | Identity resolver uses this as the confirmed record | NPPES is self-report, not a license board |
| `open_payments` | Yes — searched by confirmed NPI | Free CMS API | General payments by year/company/type | Tied to NPI, not name | Absence is not “no conflict” |
| `openalex` | Yes | Free (optional key) | Author works when name + topics + institution fit | Possible vs confirmed | Not a degree or board check |
| `pubmed` | Yes — NCBI E-utilities | Free; `PUBMED_API_KEY` raises 3→10 rps | Articles matching last name + initials, author position, DOI/PMID | Affiliation not confirmed from summary alone | Not full-text; not retraction-complete |
| `grants` | Yes — NIH RePORTER | Free public | Grants matching investigator name | Org must also fit | Other funders not searched |
| `orcid` | Yes — Public API v3 | Free; client credentials optional | Public record when affiliation/specialty/iD agrees | Unconfirmed works not attributed | Missing ORCID ≠ missing publication |
| `courtlistener` | Yes | Free; token adds excerpts | Opinions and public RECAP filings; paginated `next`; NPI-confirmed RECAP may omit the specialty word | Role often undetermined; snippets vs extracted text | Not a complete docket; PACER fetch not used |
| `youtube` | Yes when `YOUTUBE_API_KEY` is set | YouTube Data API v3 | Public video metadata (id, title, channel, date, URL, description, caption-exists flag) | First+last name plus specialty or place | Captions are not downloaded; without a key, web `site:youtube` is used |
| `justia` | Yes — HTML search | Free public | Case search by full name; unread pages reported as not read | Name match only until identity rules agree | Often blocked; not board certification |
| `state_license` | Yes — Florida MQA only | Official lookup; often bot-walled | Florida license when city or FL number on NPPES | Blocked page ≠ invalid license | Other states unimplemented |
| `state_discipline` | Same Florida lookup | Same | Discipline flag if the page can be read | Empty flag ≠ no discipline | Other states unimplemented |

Crossref is used inside **publication lookup**, not as a catalog adapter. `crossref` in the catalog is a label for that lookup.

## Web-backed catalog IDs (shared engine, not named APIs)

These IDs are answered by one web run. A “no matching record” line means the **web queries that ran** did not return an attributed page of that kind. It does **not** mean YouTube Data API, Google Maps, SEAK, or a criminal database ran.

| Catalog ID | Runtime call | Typical result on Demery Word (9) | Gap |
|---|---|---|---|
| `web_search`, `news`, `blogs`, `other_public_websites` | Gemini grounding / Serper / Brave / Tavily / Google News RSS / GDELT if configured | Mixed snippets; ResearchGate; uscourts.gov | Grounding URLs are redirects; pages often unread |
| `youtube` | YouTube Data API v3 when `YOUTUBE_API_KEY` is set; otherwise `site:youtube.com` web query | Depends on key | Caption-exists flag is stored; captions are not downloaded. AssemblyAI may transcribe at most two direct public media files, never YouTube watch URLs |
| `presentations`, `powerpoints` | Web query | “searched and returned no matching record” | No file ingest |
| `social` | Per-platform `site:` queries (LinkedIn, Facebook, Instagram, X, TikTok, Bluesky, YouTube); login-gated hosts are not fetched | Public URLs only | No platform API; Instagram/Facebook/LinkedIn pages are not opened |
| `expert_website`, `ime_websites`, `advertising`, `ime_advertising` | Public pages the engine finds | ResearchGate as “expert website”; PACER snippet misfiled as IME | Court pages were routed here by claim topic (fixed in code; not yet in Word (9)) |
| Directory IDs (`seak`, `dri`, `jurispro`, …) | Public-web hits; login/paywall not bypassed | “searched, no matching record” | Restricted directories remain unimplemented |
| `google_maps` | Web/maps snippets if a search provider returns them | Not a Maps Platform call | `GOOGLE_MAPS_API_KEY` unused |
| `corporate_affiliations` | Web + Sunbiz-class pages | Sunbiz often 403/restricted | No Sunbiz API |
| `state_court_records` | Web + CourtListener/Justia overlap | Snippets | No state-portal adapters |
| `patient_reviews` | Review hosts not scraped | Possible WebMD-class snippets | Unverified reviews |
| `university` | Faculty/policy pages if found | Often empty | No registrar API |

## Catalog-only / not implemented (no live adapter)

| Catalog ID | Status | Why |
|---|---|---|
| `education_verification` | Not implemented | No registrar or NSC/degree-verify integration |
| `university_accreditation` | Not implemented | No CHEA/USDE lookup |
| `board_certification` | Catalog stub | No ABPP verify API; web claims were misfiled from court pages |
| `certification_organization` | Stub / web | AACN directory can confirm membership if the page is read; that is not ABPP certification |
| `patents`, `trademarks` | Not called | `USPTO_API_KEY` reserved |
| `awards`, `military_claims` | Manual | No NPRC/military API; public bios are self-report |
| `depositions` | Restricted, not implemented | No TrialSmith/Lexis ingest |
| `expert_testimony` | Manual | Opinions quoting testimony ≠ transcript |
| `lexisnexis` | Restricted, never sent | Authorized subscription only |
| `criminal_records` | Restricted, never sent | No background-check vendor |
| `malpractice_records` | Restricted, never sent | NPDB is not public |
| `cv_profile` | User-supplied CV only | No crawl |

## Baseline Word report (9) — defects that are real

Inspected via text extract of `ewi-jason-a-demery-report (9).docx` (18:12 local, 22 Oct 2026). Cover: Report 3.9.2, city “Not provided”, 20 items, 0 inconsistencies, 18 questions.

| Issue | What the report shows | Honest status |
|---|---|---|
| Board certification | Executive summary lists a Justia federal case URL as “Board certification” | **Misrouted court snippet.** Not ABPP verification. Code now skips court/Justia claims for credential topics. Live 3.9.0 PDF and this Word file were **not** regenerated. |
| Education / accreditation | “not implemented” | Accurate |
| Publications | ResearchGate snippet; incomplete CV compare | Possible match, not a catalogue of all works |
| Legal records | CourtListener docket titles and some filing text; PACER `show_public_doc` unread | Search snippet ≠ full document ≠ complete docket |
| Depositions | “not implemented” | Accurate |
| Testimony | Same unread PACER snippet reused | Not a transcript |
| Criminal / malpractice | “not implemented” / mixed with lawsuits | Accurate for criminal; lawsuits are public opinions/filings, not NPDB |
| Social / video | Searched, no match / not implemented | Web `site:youtube` only |
| Grants / patents / awards / military | No NIH hits; patents/awards/military not implemented | Accurate |
| Corporate | Weak / blocked registry | Sunbiz not independently verified |
| Duplicate / weak identity | Same uscourts.gov snippet in IME, pleadings, testimony | Possible match, unread page |
| Questions | 18 items; several generic or contact-dump | 3.9.2 filters exist in uncommitted code; Word (9) still shows leftover stems |
| Completeness | Full section list | **Structure ≠ comprehensive research** |

## Coverage matrix (client categories)

| Category | Provider(s) actually callable | Demery Word (9) execution | Evidence | Verification | Report section | Remaining limitation | Est. cost |
|---|---|---|---|---|---|---|---|
| Identity | NPI Registry | Assumed live (NPPES-style license text present) | Self-reported NPI licenses | Identity only | Licenses / background | Not a board | $0 |
| Education | None dedicated; web claims | Marked not implemented | None authoritative | Unverified | Education | Registrar required | $0 until NSC/university |
| Accreditation | None | Not implemented | None | Not checked | University accreditation | CHEA/USDE manual | $0 |
| License (FL) | Florida MQA | Wall / not confirmed at issuing body | NPPES self-report | Not issuing-body | Licenses | Bot wall; other states missing | $0 |
| Board certification | None official | Justia URL misfiled | Court snippet | **Not verified** | Board certifications | Need ABPP.org | $0 |
| Publications | PubMed, OpenAlex, ORCID, Crossref lookup | ResearchGate snippet | Incomplete | Possible | Publications | Author disambiguation | $0 |
| Grants | NIH RePORTER | Searched, no match | None | Not found in NIH | Grants | Other funders | $0 |
| Patents | USPTO ODP **not called** | Not implemented | None | Not checked | Patents | Needs USPTO.gov + ID.me key | $0 after key |
| Legal opinions/filings | CourtListener, Justia, web | Ran; many snippets | Mixed text vs snippet | Role often unknown | Lawsuits, orders, pleadings, Daubert | No PACER purchase | $0 now; PACER later |
| Depositions | None | Not implemented | None | Not implemented | Depositions | TrialSmith is quote + no public API | Quote |
| Video / transcripts | YouTube Data API v3 when keyed; else web `site:youtube` | Depends on key | Metadata + caption flag; AssemblyAI on direct mp3/mp4 (cap 2) | YouTube watch URLs not transcribed | Videos | Captions.download owner-only; STT skipped for YouTube | $0 quota + ≤~$0.11 STT |
| Social | Search listings; no fetch of gated hosts | Incomplete | Possible | Unverified | Social | No scraping | $0 |
| Open Payments | CMS by NPI | Section present or empty | NPI-tied if present | Official CMS | Income/bias | Not all income | $0 |
| Criminal | Never sent | Not implemented | None | Not implemented | Criminal | No vendor | Do not use cheap aggregators |
| Malpractice | Never sent | Not implemented as NPDB | Public suits only | Not NPDB | Lawsuits | NPDB restricted | Quote / manual |
| Directories | Web only | No match | None | Not implemented | Expert directories | Login/paywall | Subscription |

## What was implemented in this pass (safe, unpaid)

Court and Justia records no longer route `board_certification`, `license`, `education`, `ime`, `advertising`, `deposition`, or `testimony` **claims** into credential, IME, or testimony-inconsistency sections. Document-type routing still files orders and motions under Orders / Pleadings.

This does **not** make the attached Word file or the live 3.9.0 PDF current. Regeneration of `192fdaa2` is still blocked pending explicit approval.
