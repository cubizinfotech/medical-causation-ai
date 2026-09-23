# EWI research providers

EWI business logic calls `ExpertResearchService` in `apps/api/src/integrations/expert-research/`. It does not call Google, PubMed, YouTube, or other vendors directly.

Each catalog entry is an independent provider. A provider validates the expert name and specialty, enforces a timeout and a per-provider rate limit, and returns a normalized result:

- status: `ok`, `error`, or `unavailable`
- access: `public`, `restricted`, or `unavailable`
- information status on each item: `verified`, `unverified`, `conflicting`, or `unavailable`
- source name, source URL when present, and retrieval timestamp

No live HTTP adapter is connected. `RESEARCH_PROVIDER=live` returns `unavailable` and sends no request, including when a credential env var is set. `RESEARCH_PROVIDER=mock` (local default) uses development fixtures where they exist. Fixtures are labeled as development data and are not verified qualifications.

An empty or unavailable result is not a finding that the expert lacks a license, publication, case, grant, award, or other credential.

Restricted providers store a title and permitted URL only. Body text is dropped. LexisNexis is interface and configuration only.

## Provider catalog

| Provider | What it is for | Requirement | Credential env | Local behavior |
|----------|----------------|-------------|---------------|----------------|
| General web search | Public web results | Paid API | `WEB_SEARCH_API_KEY` | Development fixture |
| PubMed / NCBI | Medical publications | Free API. Optional key raises the NCBI rate limit | `PUBMED_API_KEY` | Development fixture |
| Author / publication verification | Compare publication statements already retrieved | Free API (uses public bibliographic sources later) | none | Development fixture |
| ORCID | Author identity | Free public API. Optional member account | `ORCID_CLIENT_ID` | Unavailable. No ORCID iD is invented |
| Crossref | Publication metadata | Free API. Mailto is recommended | `CROSSREF_MAILTO` | Unavailable. No citation is invented |
| OpenAlex | Publication and author graph | Free API. Optional key | `OPENALEX_API_KEY` | Unavailable. No work is invented |
| Grants | NIH-style grant search | Free API | none | Unavailable. No award is invented |
| Patents | USPTO search | Free API. Some endpoints need a key | `USPTO_API_KEY` | Development fixture |
| State medical licensing and discipline | Board license and discipline | Manual, or an official API. Do not scrape boards that forbid it | `STATE_LICENSE_API_KEY` | Development fixture |
| Expert witness directories | Commercial directories | Subscription | `EXPERT_DIRECTORY_API_KEY` | Restricted fixture. Summary is not stored |
| CourtListener | Public case law | Free account token | `COURTLISTENER_API_TOKEN` | Development fixture |
| LexisNexis | Paid legal research | Subscription | `LEXISNEXIS_API_KEY` | Restricted link only. No request is sent |
| YouTube / videos | Public videos | Google account API key | `YOUTUBE_API_KEY` | Unavailable. No video is invented |
| News and blogs | News mentions | Paid API or account | `NEWS_API_KEY` | Development fixture |
| Public social media | Official platform APIs | User-provided credentials. No scraping | `SOCIAL_API_KEY` | Unavailable. No profile is invented |
| University information | Faculty or appointment pages supplied for the case | Manual | none | Unavailable. No appointment is invented |
| Expert websites | A site URL supplied for the investigation | Manual. No general crawl | none | Development fixture |
| IME and expert advertising sites | Commercial advertising directories | Subscription | `IME_DIRECTORY_API_KEY` | Unavailable. No listing is invented |

## Local setup

Leave the credential variables unset. In the root `.env`:

```
RESEARCH_PROVIDER=mock
RESEARCH_REQUEST_TIMEOUT_MS=20000
RESEARCH_MIN_INTERVAL_MS=0
```

`RESEARCH_MIN_INTERVAL_MS` is the minimum gap between calls to the same provider. `0` disables the limiter. Timeouts use `RESEARCH_REQUEST_TIMEOUT_MS`.
