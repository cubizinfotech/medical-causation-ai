# Research providers

EWI business logic calls `ExpertResearchService` in `apps/api/src/integrations/expert-research/`. It does not call Google, PubMed, YouTube, or other vendors directly.

Each catalog entry is an independent provider. A provider validates the expert name and specialty, enforces a timeout and a per-provider rate limit, and returns a normalized result:

- status: `ok`, `error`, or `unavailable`
- access: `public`, `restricted`, or `unavailable`
- information status on each item: `verified`, `unverified`, `conflicting`, or `unavailable`
- source name, source URL when present, and retrieval timestamp

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

## Provider catalog

| Provider | What it is for | Class | Credential env | Local behavior |
|----------|----------------|-------|----------------|----------------|
| General web search | Public web results | Paid, optional | `WEB_SEARCH_API_KEY` | Development fixture |
| PubMed / NCBI | Medical publications | Free API, optional key | `PUBMED_API_KEY` | Development fixture |
| Author / publication verification | Compare publication statements already retrieved | Free, not connected | none | Development fixture |
| ORCID | Author identity | Free public API | `ORCID_CLIENT_ID` | Unavailable. No ORCID iD is invented |
| Crossref | Publication metadata | Free API | `CROSSREF_MAILTO` | Unavailable. No citation is invented |
| OpenAlex | Publication and author graph | Free API | `OPENALEX_API_KEY` | Unavailable. No work is invented |
| Grants | NIH-style grant search | Free API | none | Unavailable. No award is invented |
| Patents | USPTO search | Free API | `USPTO_API_KEY` | Development fixture |
| State medical licensing and discipline | Board license and discipline | Official API or manual review. Do not scrape boards that forbid it | `STATE_LICENSE_API_KEY` | Development fixture |
| Expert witness directories | Commercial directories | Paid, optional | `EXPERT_DIRECTORY_API_KEY` | Restricted fixture. Summary is not stored |
| CourtListener | Public case law | Free account token | `COURTLISTENER_API_TOKEN` | Development fixture |
| LexisNexis | Paid legal research | Paid, optional | `LEXISNEXIS_API_KEY` | Restricted link only. No request is sent |
| YouTube / videos | Public videos | Free API with a Google key | `YOUTUBE_API_KEY` | Unavailable. No video is invented |
| News and blogs | News mentions | Paid, optional | `NEWS_API_KEY` | Development fixture |
| Public social media | Official platform APIs | Optional. No scraping | `SOCIAL_API_KEY` | Unavailable. No profile is invented |
| University information | Faculty or appointment pages supplied for the case | Manual | none | Unavailable. No appointment is invented |
| Expert websites | A site URL supplied for the investigation | Manual. No general crawl | none | Development fixture |
| IME and expert advertising sites | Commercial advertising directories | Paid, optional | `IME_DIRECTORY_API_KEY` | Unavailable. No listing is invented |

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
