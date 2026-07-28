# AI Architecture

## Overview

The **Medical Causation AI** platform uses a provider-agnostic AI architecture that supports multiple LLM and embedding providers. All AI operations flow through a single `AiService` entry point — no module calls providers directly.

This document describes the AI foundation implemented in **Phase 1 — AI Foundation**.

## Design Goals

- **Provider-agnostic** — switch LLM and embedding providers via environment variables
- **Single entry point** — all AI requests go through `AiService`
- **Auditable** — token usage, timing, and provider metadata tracked on every operation
- **Configurable** — models, temperature, token limits controlled via environment
- **Extensible** — new providers added by implementing `ILlmProvider` or `IEmbeddingProvider`
- **Template-driven prompts** — prompts stored as files, not hardcoded in services

## Architecture Overview

```
Future Modules (RAG, Reports, Causation Engine)
                    │
                    ▼
              ┌───────────┐
              │ AiService │  ← Single entry point
              └─────┬─────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
         ▼          ▼          ▼
  ┌────────────┐ ┌────────┐ ┌──────────────┐
  │ Prompt     │ │ LLM    │ │ Embedding    │
  │ Service    │ │ Factory│ │ Factory      │
  └────────────┘ └───┬────┘ └──────┬───────┘
                     │             │
              ┌──────┴──────┐ ┌────┴─────────┐
              │ ILlmProvider│ │IEmbedding    │
              │ implementations│Provider impls│
              └─────────────┘ └──────────────┘
```

## Request Flow

### LLM Completion

```
1. Caller invokes AiService.complete(options)
2. AiService loads/renders prompt template (if promptTemplateId provided)
3. AiService validates token limits against TokenConfig
4. LlmProviderFactory resolves active provider from AI_PROVIDER env var
5. Provider.complete(request) is called
6. Response includes content, model, provider, token usage, execution time
```

### Embedding Generation (Future)

```
1. Caller invokes AiService.embed(request)
2. EmbeddingProviderFactory resolves active provider from EMBEDDING_PROVIDER
3. Provider.embed(request) is called
4. Response includes vectors, dimensions, usage, execution time
```

## Supported LLM Providers

| Provider | Env Value | Default Model | API Key Variable |
|----------|-----------|---------------|------------------|
| **OpenRouter** (default) | `openrouter` | `openai/gpt-4o` | `OPENROUTER_API_KEY` |
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Anthropic Claude | `anthropic` | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| Google Gemini | `gemini` | `gemini-2.0-flash` | `GOOGLE_API_KEY` |
| Groq | `groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |

### Provider Switching

Change the active LLM provider with a single environment variable:

```env
AI_PROVIDER=openrouter   # default
AI_PROVIDER=openai
AI_PROVIDER=anthropic
AI_PROVIDER=gemini
AI_PROVIDER=groq
```

No code changes required. Restart the application after changing the variable.

## Supported Embedding Providers

| Provider | Env Value | Default Model | Dimensions |
|----------|-----------|---------------|------------|
| OpenAI (default) | `openai` | `text-embedding-3-small` | 1536 |
| Google Gemini | `gemini` | `text-embedding-004` | 768 |
| Voyage AI | `voyage` | `voyage-3` | 1024 |
| Jina AI | `jina` | `jina-embeddings-v3` | 1024 |
| Nomic | `nomic` | `nomic-embed-text` | 768 |
| Ollama (future) | `ollama` | `nomic-embed-text` | 768 |

```env
EMBEDDING_PROVIDER=openai   # default
EMBEDDING_PROVIDER=voyage
EMBEDDING_PROVIDER=jina
```

## Module Structure

```
apps/api/src/ai/
├── ai.module.ts              # NestJS module
├── config/
│   └── ai-config.service.ts    # Typed config accessor
├── constants/
│   └── ai-providers.constant.ts
├── interfaces/
│   ├── llm-provider.interface.ts
│   └── embedding-provider.interface.ts
├── types/
│   ├── llm.types.ts
│   ├── embedding.types.ts
│   ├── token-usage.types.ts
│   └── prompt.types.ts
├── exceptions/
│   └── ai.exceptions.ts
├── providers/
│   ├── base/                   # Abstract base classes
│   ├── embeddings/             # Embedding provider stubs
│   ├── llm-provider.factory.ts
│   ├── embedding-provider.factory.ts
│   └── *.provider.ts           # LLM provider stubs
├── services/
│   ├── ai.service.ts           # Single entry point
│   └── prompt.service.ts       # Template loading & rendering
├── prompts/
│   ├── system/                 # System prompts
│   ├── medical/                # Medical analysis prompts
│   ├── reports/                # Report generation prompts
│   ├── testing/                # Test prompts
│   └── prompt.registry.ts      # Template registry
├── templates/
│   └── index.ts                # Template metadata exports
└── utils/
    └── prompt-template.util.ts # Variable substitution helpers
```

## Configuration Classes

All configuration is read from environment variables in `apps/api/src/config/`:

| Config Class | File | Purpose |
|-------------|------|---------|
| `ProviderConfig` | `provider.config.ts` | LLM provider settings |
| `EmbeddingConfig` | `embedding.config.ts` | Embedding provider settings |
| `PromptConfig` | `prompt.config.ts` | Template directory, caching |
| `TokenConfig` | `token.config.ts` | Token limits, cost estimation |
| `AiConfigService` | `ai/config/ai-config.service.ts` | Typed NestJS accessor |

## Prompt Management Strategy

### Template Files

Prompts are stored as `.prompt.txt` files in category directories:

```
prompts/
├── system/default.system.prompt.txt
├── medical/causation-analysis.prompt.txt
├── reports/report-generation.prompt.txt
└── testing/smoke-test.prompt.txt
```

### Variable Substitution

Templates use `{{variableName}}` syntax:

```
Injury Type: {{injuryType}}
Accident Type: {{accidentType}}
```

### Registry

All templates are registered in `prompt.registry.ts` with metadata (ID, version, variables, description).

### Usage

```typescript
// Load and render a template
const prompt = await aiService.loadPrompt('medical/causation-analysis', {
  injuryType: 'Stroke',
  accidentType: 'Motor Vehicle Collision',
  patientAge: '55',
  timeSinceIncident: '3 days',
  preExistingConditions: 'Hypertension',
});

// Use in a completion
const response = await aiService.complete({
  messages: [],
  promptTemplateId: 'medical/causation-analysis',
  promptVariables: { ... },
});
```

## Token Usage Types

Every AI operation tracks:

```typescript
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface AiUsageMetrics extends TokenUsage {
  estimatedCostUsd?: number;  // informational only
  executionTimeMs: number;
  provider: string;
  model: string;
}
```

## Error Handling

| Exception | Code | When Thrown |
|-----------|------|-------------|
| `ProviderUnavailableException` | `PROVIDER_UNAVAILABLE` | Provider not configured or API down |
| `InvalidModelException` | `INVALID_MODEL` | Requested model not supported |
| `RateLimitExceededException` | `RATE_LIMIT_EXCEEDED` | Provider rate limit hit |
| `TokenLimitExceededException` | `TOKEN_LIMIT_EXCEEDED` | Request exceeds token limits |
| `InvalidPromptException` | `INVALID_PROMPT` | Template not found or missing variables |
| `ConfigurationErrorException` | `CONFIGURATION_ERROR` | Invalid AI configuration |
| `NotImplementedException` | `NOT_IMPLEMENTED` | API integration pending |

## Frontend AI Client

```
apps/web/src/services/ai/
├── types.ts        # Mirror of backend AI types
├── ai.client.ts    # AiClient class (API stubs)
└── index.ts
```

The frontend `AiClient` defines methods that will call backend AI endpoints in a future phase. No API calls are made yet.

## Future Embedding Workflow

```
Document Upload
      │
      ▼
PDF Parser (future)
      │
      ▼
Text Chunker (future)
      │
      ▼
AiService.embed(inputs)  ← Uses EmbeddingProviderFactory
      │
      ▼
PostgreSQL + pgvector (future)
      │
      ▼
Vector Similarity Search (future)
      │
      ▼
AiService.complete(context + retrieved chunks)
```

## Phase 1 — AI Foundation Status

- [x] AI module structure (`apps/api/src/ai/`)
- [x] `ILlmProvider` interface with 5 provider implementations (stubs)
- [x] `IEmbeddingProvider` interface with 6 provider implementations (stubs)
- [x] `AiService` single entry point
- [x] `PromptService` with file-based templates
- [x] Configuration classes (Provider, Embedding, Prompt, Token)
- [x] Token usage types and cost estimation utilities
- [x] AI exception hierarchy
- [x] Frontend `AiClient` service layer (stubs)
- [ ] Actual API calls to LLM providers (next phase)
- [ ] Embedding generation (next phase)
- [ ] LangChain / Vercel AI SDK integration (next phase)

## Related Documentation

- [RAG Workflow](./rag-workflow.md)
- [Architecture](./architecture.md)
- [Development Guide](./development.md)
