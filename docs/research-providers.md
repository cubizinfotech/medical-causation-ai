# Research providers

EWI business logic calls `ExpertResearchService` in `apps/api/src/integrations/expert-research/`. It does not call Google, PubMed, YouTube, or other vendors directly.

Each catalog entry is an independent provider. A provider validates the expert name, city, and specialty, enforces a timeout and a per-provider rate limit, and returns a normalized result:

- status: `ok`, `no_result`, `error`, or `unavailable`
- outcome: `success`, `no_result`, `unavailable`, `restricted`, `authentication_required`, `rate_limited`, `timeout`, `api_failure`, or `conflicting`
- access: `public`, `restricted`, or `unavailable`
- information status on each item: `verified`, `unverified`, `conflicting`, or `unavailable`
- identity match: `matched` or `uncertain`
- source name, source URL when present, and retrieval timestamp

A provider that fails, times out, is rate limited, or requires authentication is recorded and the investigation continues. A shared name is not enough to treat two records as the same expert. City or specialty must also agree. An uncertain record is kept and is not merged into the expert profile.

No live HTTP adapter is connected. `RESEARCH_PROVIDER=live` returns `unavailable` and sends no request, including when a credential env var is set. `RESEARCH_PROVIDER=mock` (local default) uses development fixtures where they exist. Fixtures are labeled as development data and are not verified qualifications.

An empty or unavailable result is not a finding that the expert lacks a license, publication, case, grant, award, or other credential.

Restricted providers store a title and permitted URL only. Body text is dropped. LexisNexis is interface and configuration only.

Paid research credentials are not required for local development.

## Which providers are required

| Class | Meaning for this project |
|-------|--------------------------|
| Free / local | Works in development with fixtures, or a public API that is not connected yet |
| Paid | A commercial account would be required before a live adapter can run |
| Optional | Not required for local development or for the first production deployment |
| Required for production | None of these research vendors are required to deploy the application |

The investigation still runs when a provider is unavailable. Live vendor access is a later decision.

The investigation builds one research plan from the catalog and runs it by stage. Live HTTP is not connected for any row. Restricted rows are not scraped. LexisNexis stays on authorized access, and its PDFs are not stored.

## Provider catalog

| Provider | Stage | Class | Credential env | Local status |
|----------|-------|-------|----------------|--------------|
| General web research | CV and profiles | Paid, optional | `WEB_SEARCH_API_KEY` | Fixture, plus a same-name other-city hit marked uncertain |
| CV and profile research | CV and profiles | Manual | none | Unavailable. No CV is invented |
| ORCID | CV and profiles | Free API | `ORCID_CLIENT_ID` | Unavailable. No ORCID iD is invented |
| Education and degree verification | Education | Manual | none | Unavailable. No degree is invented |
| University accreditation | Education | Manual | none | Unavailable. No accreditation is invented |
| State medical licenses | Licenses | Official API or manual. Do not scrape boards that forbid it | `STATE_LICENSE_API_KEY` | Fixture |
| State disciplinary and board actions | Licenses | Official record or manual. Do not scrape | none | Unavailable. No action is invented |
| Board certification verification | Boards | Manual | none | Unavailable. No certification is invented |
| Certification organization verification | Boards | Manual | none | Unavailable. No membership is invented |
| Publications (PubMed / NCBI) | Publications | Free API, optional key | `PUBMED_API_KEY` | Fixture |
| Author and co-author verification | Publications | Free, uses retrieved statements | none | Fixture |
| Lead and first-author verification | Publications | Free, uses retrieved statements | none | Unavailable. No author order is invented |
| Crossref | Publications | Free API | `CROSSREF_MAILTO` | Unavailable. No citation is invented |
| OpenAlex | Publications | Free API | `OPENALEX_API_KEY` | Unavailable. No work is invented |
| Grants | Grants | Free API | none | Unavailable. No grant is invented |
| Grant results | Grants | Free API | none | Unavailable. No result is invented |
| Patents | Patents | Free API | `USPTO_API_KEY` | Fixture |
| Trademarks | Patents | Free API | none | No result. Not evidence that no mark exists |
| Awards and medals | Awards | Manual | none | Unavailable. No award is invented |
| Military claims | Awards | Manual | none | Unavailable. No claim is invented |
| Legal cases (CourtListener) | Legal | Free account token | `COURTLISTENER_API_TOKEN` | Fixture |
| Motions | Legal | Manual | none | Unavailable. No motion is invented |
| Orders | Legal | Manual | none | Unavailable. No order is invented |
| Pleadings | Legal | Manual | none | Unavailable. No pleading is invented |
| Depositions | Legal | Restricted. No scraping | none | Unavailable. No transcript is invented |
| Expert testimony | Legal | Manual | none | Unavailable. No testimony is invented |
| LexisNexis | Legal | Paid, authorized access only | `LEXISNEXIS_API_KEY` | Restricted link only. No request is sent. PDFs are not stored |
| Expert directories | Directories | Paid, optional. No scraping | `EXPERT_DIRECTORY_API_KEY` | Restricted fixture. Summary is not stored |
| DRI | Directories | Paid, optional. No scraping | `DRI_API_KEY` | Unavailable. No listing is invented |
| SEAK | Directories | Paid, optional. No scraping | `SEAK_API_KEY` | Unavailable. No listing is invented |
| ALM / Law.com | Directories | Paid, optional. No scraping | `ALM_API_KEY` | Unavailable. No listing is invented |
| JurisPro | Directories | Paid, optional. No scraping | `JURISPRO_API_KEY` | Unavailable. No listing is invented |
| ExpertLaw | Directories | Paid, optional. No scraping | `EXPERTLAW_API_KEY` | Unavailable. No listing is invented |
| ExpertPages | Directories | Paid, optional. No scraping | `EXPERTPAGES_API_KEY` | Unavailable. No listing is invented |
| ExpertWitness.com | Directories | Paid, optional. No scraping | `EXPERTWITNESS_API_KEY` | Unavailable. No listing is invented |
| Other expert directories | Directories | Paid, optional. No scraping | `OTHER_DIRECTORY_API_KEY` | Unavailable. No listing is invented |
| Expert websites | Websites | Manual. No general crawl | none | Fixture |
| Advertising | Websites | Paid, optional. No scraping | `ADVERTISING_DIRECTORY_API_KEY` | Unavailable. No advertisement is invented |
| Google Maps and location | Websites | Paid API | `GOOGLE_MAPS_API_KEY` | Unavailable. No address is invented |
| IME websites | IME | Manual. No crawl | none | Unavailable. No site is invented |
| IME advertising | IME | Paid, optional. No scraping | `IME_DIRECTORY_API_KEY` | Unavailable. No listing is invented |
| YouTube and videos | Videos | Account API key | `YOUTUBE_API_KEY` | Unavailable. No video is invented |
| Presentations | Videos | Manual | none | Unavailable. No talk is invented |
| PowerPoints | Videos | Manual | none | Unavailable. No deck is invented |
| Social media | Social | Official API only. No scraping | `SOCIAL_API_KEY` | Unavailable. No profile is invented |
| News | News | Paid, optional | `NEWS_API_KEY` | Fixture |
| Blogs | News | Manual. Do not scrape sites that forbid it | none | Unavailable. No post is invented |
| University employment and activity rules | University rules | Manual. No crawl | none | Unavailable. No appointment is invented |
| Patient reviews | Public records | Restricted. No scraping | none | Unavailable. No review is invented |
| Open Payments | Public records | Free public data | none | Unavailable. No payment is invented |
| Corporate affiliations | Public records | Manual | none | Unavailable. No affiliation is invented |
| Criminal records | Public records | Authorized access only. No scraping | `CRIMINAL_RECORDS_API_KEY` | Unavailable. No record is invented |
| Malpractice records | Public records | Authorized access only. No scraping | `MALPRACTICE_RECORDS_API_KEY` | Unavailable. No claim is invented |

## Local setup

Leave the credential variables empty. In the root `.env`:

```
RESEARCH_PROVIDER=mock
RESEARCH_REQUEST_TIMEOUT_MS=20000
RESEARCH_MIN_INTERVAL_MS=0
```

`RESEARCH_MIN_INTERVAL_MS` is the minimum gap between calls to the same provider. `0` disables the limiter. Timeouts use `RESEARCH_REQUEST_TIMEOUT_MS`.

## Related

- [ewi-workflow.md](./ewi-workflow.md)
- [ewi-architecture.md](./ewi-architecture.md)
- [ewi-ai-analysis.md](./ewi-ai-analysis.md)
