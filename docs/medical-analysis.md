# Medical Analysis Engine

## Purpose

The **Medical Analysis Engine** uses the RAG Retrieval Engine together with the configured LLM provider to generate **structured, evidence-based medical causation analysis** for personal injury attorneys.

This phase implements **analysis only** — no PDF report generation, no medical diagnosis, no case management.

## Critical Safety Rules

- AI **must** use retrieved knowledge base context — never bypasses RAG
- AI **must not** invent citations or page numbers
- AI **must** admit when evidence is insufficient
- Confidence score is **not** a medical diagnosis
- Output is educational legal research assistance for attorney review

## Module Location

```
apps/api/src/modules/medical-analysis/
├── prompts/          # Template files (system, analysis, evidence, JSON)
├── builders/         # Query and prompt builders
├── validators/       # Safety validation and response mapping
├── services/         # MedicalAnalysisService (entry point)
├── types/            # Request/result schemas
└── ...
```

## Analysis Workflow

```
Patient Case Input
        ↓
Build Medical Query (MedicalQueryBuilder)
        ↓
RAG Retrieval (RetrievalService — required)
        ↓
Validate Retrieved Context (AnalysisSafetyValidator)
        ↓
Build Prompts (AnalysisPromptBuilder + template files)
        ↓
LLM Provider (AiService.complete via configured AI_PROVIDER)
        ↓
Parse JSON Output
        ↓
Validate Citations (no hallucinated chunkIds)
        ↓
Structured MedicalAnalysisResult
```

### Entry Point

```typescript
const result = await medicalAnalysisService.analyze({
  medicalQuestion: 'Can mild traumatic brain injury increase the risk of stroke?',
  injury: 'Mild traumatic brain injury',
  diagnosis: 'Stroke',
  symptoms: 'Headache, cognitive difficulty',
  medicalHistory: 'No prior stroke',
});
```

## Prompt Strategy

Prompts are stored as **template files** in `prompts/`:

| Template | Purpose |
|----------|---------|
| `system.prompt.txt` | Safety rules, role definition, no-diagnosis disclaimer |
| `medical-analysis.prompt.txt` | Case context + retrieved evidence injection |
| `evidence-evaluation.prompt.txt` | Supporting/opposing/neutral classification rules |
| `json-output.prompt.txt` | Structured JSON schema instructions |

Templates use `{{variable}}` substitution. No large prompts are hardcoded in services.

## JSON Schema

```json
{
  "executiveSummary": "string",
  "patientSummary": "string",
  "medicalQuestion": "string",
  "retrievedEvidence": [
    {
      "chunkId": "string",
      "excerpt": "string",
      "classification": "supporting|opposing|neutral|unknown",
      "classificationReasoning": "string"
    }
  ],
  "supportingEvidence": [{ "chunkId": "string", "excerpt": "string", "reasoning": "string" }],
  "opposingEvidence": [{ "chunkId": "string", "excerpt": "string", "reasoning": "string" }],
  "neutralEvidence": [{ "chunkId": "string", "excerpt": "string", "reasoning": "string" }],
  "aiReasoning": "string",
  "confidenceScore": 0,
  "confidenceExplanation": "string",
  "limitations": ["string"],
  "conclusion": "string",
  "citations": [{ "chunkId": "string", "statement": "string" }]
}
```

New fields can be added without breaking existing consumers.

## Evidence Classification

| Type | Meaning |
|------|---------|
| `supporting` | Evidence suggests trauma may contribute to the condition |
| `opposing` | Evidence argues against causation |
| `neutral` | Background information, neither supports nor opposes |
| `unknown` | Ambiguous or insufficient to classify |

Each classification includes reasoning tied to a specific `chunkId`.

## Confidence Score

- Integer **0–100** based on retrieved evidence quality and consistency
- Includes explanation and mandatory disclaimer
- **Not** a medical diagnosis or legal determination
- Scores below 40 expected when evidence is insufficient

## Citation Mapping

Every AI statement maps to retrieved chunks:

| Field | Description |
|-------|-------------|
| `chunkId` | Stable chunk identifier from indexing |
| `documentName` | Source document title |
| `pageNumber` | PDF page number when available |
| `chunkNumber` | Chunk index within document |
| `similarityScore` | Retrieval relevance score |
| `citationText` | Formatted citation string |

Post-LLM validation rejects any `chunkId` not present in the retrieval result.

## Multi-Provider Support

Uses existing `AI_PROVIDER` configuration:

| Provider | Env Value |
|----------|-----------|
| OpenRouter (default) | `openrouter` |
| OpenAI | `openai` |
| Claude | `anthropic` |
| Gemini | `gemini` |
| Groq | `groq` |

## Configuration

```env
AI_PROVIDER=openrouter
AI_CHAT_MODEL=openai/gpt-4o-mini
OPENROUTER_API_KEY=your-key
EMBEDDING_PROVIDER=openrouter
RAG_TOP_K=10
```

## Background Jobs & Case History

Analysis runs as a **background job** (BullMQ + Redis) with live WebSocket progress. Each submitted case is persisted in PostgreSQL (`cases.analysis_cases`).

### REST Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/medical-analysis/jobs` | Submit case → returns `{ caseId, jobId }` |
| `GET` | `/medical-analysis/jobs/:jobId` | Poll job status from Redis |
| `GET` | `/medical-analysis/histories` | List recent cases (limit 50) |
| `GET` | `/medical-analysis/histories/:id` | Case detail + full report JSON |
| `DELETE` | `/medical-analysis/histories/:id` | Delete case and Redis job record |

### WebSocket

Namespace `/medical-analysis` (Socket.IO) emits `job:update` events with step, progress, and result.

### Case Storage

- **PostgreSQL** — durable case intake, status, and completed report (`result` JSON column)
- **Redis** — ephemeral job state (`analysis:job:{jobId}`), TTL configurable via `ANALYSIS_JOB_TTL_SECONDS`

## Related Documentation

- [RAG Workflow](./rag-workflow.md)
- [Indexing](./indexing.md)
- [AI Architecture](./ai-architecture.md)
