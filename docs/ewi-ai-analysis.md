# EWI AI analysis

The investigation collects records from research providers first. `EwiAnalysisService` then interprets that packet through the shared `AiService` / prompt-registry stack. The model is not a source of truth and must not invent evidence.

Collected findings stay in `ewi.research_findings`. The interpretation is stored separately in `ewi.investigation_analyses`.

## What the analysis does

Deterministic structure (always built from the packet):

1. Group findings by category.
2. Mark duplicate titles or URLs.
3. Compare statements that share a category, including CV versions when present.
4. Keep conflicts that the collected statements already show.
5. Record categories whose sources returned nothing, or were restricted or unavailable.
6. Record CV-to-public gaps only when both sides are present in the collected raw fields.
7. Emit section summaries for expert background, credentials, CV comparison, inconsistencies, legal matters, orders, motions, depositions, contradictory testimony, publications, authorship, grants/patents, licenses/certifications, memberships, websites, videos, social media, income/bias, university rules, missing/unverified gaps, and investigation findings.
8. Generate 100+ leading questions grounded only in collected `findingKey` / source URL / `source:<provider>` references.
9. Attach every conclusion, section summary, investigation finding, and question to evidence IDs or source URLs.

Model wording may replace summary/conclusions/questions/section narrative text only after validation. Assessments stay packet-derived.

## Evidence status labels

| Label | Meaning |
|-------|---------|
| Verified | A collected source already marked the statement verified. |
| Partially Verified | Collected evidence is only partly corroborated. The model cannot apply this label on its own. |
| Conflicting | Collected statements disagree. |
| Not Verified | A statement was collected and was not verified. |
| Not Found | A source answered and returned no record. That is not proof the expert lacks the qualification. |
| Unavailable | The source did not return a usable record. Content is not inferred. |
| Restricted | The source requires authorized access. Content is not stored or inferred. |

Assessments are computed from the collected packet. Model output cannot upgrade them.

Inconsistency labels on `ewi.discrepancies` remain assigned by `DiscrepancyAnalyzer` from collected statements (including multiple CV versions when present). Accepted model wording does not replace those labels.

## Model wording

Prompts (prompt-template registry):

- `ewi/investigation-analysis-system`
- `ewi/investigation-analysis`

They live in `apps/api/src/ai/prompts/ewi/` and are registered in the shared prompt registry. The call goes through `AiService` with `responseFormat: json`. No provider name is hardcoded. No second AI system is introduced.

The model returns structured JSON: summary, conclusions, sectionSummaries, investigationFindings, and ≥100 questions. Before anything is saved, `validateAiAnalysis` checks that:

- the payload is JSON in the expected shape
- every source reference exists in the packet
- questions cite evidence and meet the 100+ minimum
- the text does not invent cases, dates, publications, credentials, quotes, court findings, income, social posts, testimony, statistics, URLs, multi-digit numbers, degrees, PMIDs, or social channels absent from the packet

If the model is unavailable, the JSON is malformed, or a claim is unsupported, the model text is discarded. The investigation keeps the deterministic analysis built only from collected findings.

## Local development

`RESEARCH_PROVIDER=mock` supplies fixtures. Those fixtures stay not verified. With no available model provider, analysis is deterministic and does not call an external model.

Analysis is stored as structured JSON. The Word report is a separate document built from the collected findings. See [ewi-report-workflow.md](./ewi-report-workflow.md).
