# EWI AI analysis

The investigation collects records from research providers first. `EwiAnalysisService` then interprets that packet. The model is not a source of truth.

Collected findings stay in `ewi.research_findings`. The interpretation is stored separately in `ewi.investigation_analyses`.

## What the analysis does

1. Group findings by category.
2. Mark duplicate titles or URLs.
3. Compare statements that share a category.
4. Keep conflicts that the collected statements already show.
5. Record categories whose sources returned nothing, or were restricted or unavailable.
6. Record CV-to-public gaps only when both sides are present in the collected raw fields.
7. Write a summary that says the information could not be verified when the sources do not support a stronger label.
8. Attach every conclusion and question to a `findingKey` or `source:<provider>` reference.

## Assessment labels

| Label | Meaning |
|-------|---------|
| Verified | A collected source already marked the statement verified. |
| Partially verified | Reserved for a collected group that already contains a verified statement. The model cannot apply this label on its own. |
| Conflicting | Collected statements disagree. |
| Unverified | A statement was collected and was not verified. |
| Not found | A source answered and returned no record. That is not proof the expert lacks the qualification. |
| Restricted/Unavailable | The source requires authorized access or did not return a usable record. Content is not stored. |

Assessments are computed from the collected packet. Model output cannot upgrade them.

## Model wording

Prompts:

- `ewi/investigation-analysis-system`
- `ewi/investigation-analysis`

They live in `apps/api/src/ai/prompts/ewi/` and are registered in the shared prompt registry. The call goes through `AiService`. No provider name is hardcoded.

The model may return a summary, conclusions, and questions as JSON. Before anything is saved, `validateAiAnalysis` checks that:

- the payload is JSON in the expected shape
- every source reference exists in the packet
- the text does not introduce a URL, multi-digit number, degree, board certification, PMID, or social channel that is absent from the packet

If the model is unavailable, the JSON is malformed, or a claim is unsupported, the model text is discarded. The investigation keeps the deterministic analysis built only from collected findings.

## Local development

`RESEARCH_PROVIDER=mock` supplies fixtures. Those fixtures stay unverified. With no available model provider, analysis is deterministic and does not call an external model.

Analysis is stored as structured JSON. The Word report is a separate document built from the collected findings. See [ewi-report-workflow.md](./ewi-report-workflow.md).
