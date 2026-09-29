# EWI online presence research

Online presence research runs through the shared expert-research catalog. There is no second provider stack.

`OnlinePresenceResearchService` selects the presence providers. `buildOnlinePresenceDossier` turns collected evidence into websites, directories, IME listings, videos, social profiles, news, blogs, patient reviews, and map locations. The model does not invent claims and does not draw medical or legal conclusions from reviews.

## Categories and sources

| Category | Catalog providers | Access notes |
|----------|-------------------|--------------|
| Expert website | `expert_website` | Public pages supplied for the investigation. No general crawl |
| Professional / advertising websites | `advertising` | Restricted. Metadata and link only |
| Other public websites | `other_public_websites` | Public pages only. Copyrighted bodies are not copied unless permitted |
| IME websites | `ime_websites`, `ime_advertising` | Public IME pages; advertising remains restricted |
| Expert witness directories | `expert_directory` and directory vendors | Restricted. No scraping |
| YouTube / videos / presentations / PowerPoints | `youtube`, `presentations`, `powerpoints` | Public metadata. Transcripts only when legally and technically permitted |
| Social media | `social` | Public content only. No friend requests, private accounts, or auth bypass |
| News / blogs | `news`, `blogs` | Public references. Do not scrape sites that forbid it |
| Patient reviews | `patient_reviews` | Restricted. Neutral summary and permitted metadata only |
| Google Maps / location | `google_maps` | Public business listings where permitted |

An unavailable source is recorded as unavailable. The investigation does not pretend that source completed a search.

## Website fields

When the source provides them:

- URL, title, source, date retrieved
- summary
- relevant claims, advertising claims, forensic claims, expert witness claims
- treatment/practice information
- potential conflict or bias indicators
- evidence references

Copyrighted page bodies are not downloaded or stored unless storage is legally permitted.

## Videos

Public video records keep title, URL, date, source, description, summary, and important statements. A transcript is stored only when it is legally and technically permitted. If transcription is unavailable, the link is kept and the dossier records that transcription was unavailable.

## Social media

Supported public platforms include Facebook, LinkedIn, X/Twitter, YouTube, TikTok, Instagram/Meta, Bluesky, and other public platforms when a public record is collected. The system does not send friend requests, contact the expert, bypass privacy controls, access private accounts, or bypass authentication.

## Google Maps

Public business and location information may be recorded. If the collected evidence suggests a residence or a shared/hourly office, the dossier marks the address as requiring verification. Unsupported conclusions are not drawn.

## Patient reviews

Stored fields are the source URL, date, rating where permitted, relevant review text only where legally permitted, and a neutral summary. Reviews are not used to make medical or legal conclusions.

## Code

- `apps/api/src/modules/ewi/research/online-presence/`
- Catalog rows stay in `integrations/expert-research`
- Report sections 12–17 render the dossier groups
- History rebuilds the dossier from stored findings and attributes
