# MCA workflow: from "Run AI Analysis" to the report

This page follows one Medical Causation Analysis request through the code: what the browser does, what the API does, where data is stored, and how the finished report gets back to the screen.

For the product overview, see [how-it-works.md](./how-it-works.md). For the Expert Witness flow, see [ewi-workflow.md](./ewi-workflow.md).

## The short version

1. The attorney fills in the case form and clicks **Run AI Analysis**.
2. The website sends the case to the API. The API saves it, puts a job on a Redis queue, and replies immediately with a `jobId`.
3. A background worker inside the API picks up the job. It searches the indexed medical books, gives the best passages to the AI model, and checks that every citation points to a real passage.
4. While the worker runs, it pushes progress to the browser over a WebSocket. The browser also polls every 4 seconds as a backup.
5. When the job finishes, the full report is saved in PostgreSQL. The attorney clicks **View Report**, and the report page loads it from the database.

```mermaid
sequenceDiagram
    actor U as Attorney
    participant W as Website (Next.js :3000)
    participant A as API (NestJS :3001)
    participant R as Redis (job record + BullMQ queue)
    participant P as PostgreSQL (cases + book chunks)
    participant K as Worker (inside the API)
    participant AI as Embedding + LLM providers

    U->>W: Fill case form, click "Run AI Analysis"
    W->>W: Save form in sessionStorage, go to /mca/analysis
    W->>A: POST /medical-analysis/jobs (Bearer token)
    A->>P: Insert cases.analysis_cases row (queued)
    A->>R: Save job record, add job to "medical-analysis" queue
    A-->>W: 202 { caseId, jobId, status: "queued" }
    W->>A: WebSocket /medical-analysis, subscribe { jobId }
    K->>R: Take the job
    K->>AI: Embed the case description
    K->>P: Vector search + keyword search over chunks
    K->>AI: Ask the LLM, giving only the retrieved passages
    K->>K: Reject citations to passages it was not given
    loop every step
        K->>R: Update job record
        K->>P: Copy status to analysis_cases
        A-->>W: job:update (progress, step, message)
    end
    K->>P: Save full result JSON
    A-->>W: job:update (status completed + result)
    U->>W: Click "View Report"
    W->>A: GET /medical-analysis/histories/:caseId
    A->>P: Read the case and result
    A-->>W: Report JSON, rendered on screen
```

## Before any of this works

MCA can only cite what is in the database. The medical books in `knowledge-base/` must be indexed first:

```bash
npm run index:kb
```

Indexing reads each PDF, splits the text into chunks, turns each chunk into a 768-number embedding, and stores the chunks in `documents.document_chunks` and the embeddings in `vectors.chunk_embeddings`. If nothing is indexed, every analysis fails at step 4 below with an insufficient-evidence error. That is intentional: the AI is never asked to answer without sources.

## Step by step

### 1. The case form (browser only)

**Page:** `/mca/case`, which renders [case-form.tsx](../apps/web/src/components/mca/demo/case-form.tsx).

- The attorney fills in age, gender, accident date and type, accident description, diagnosis, symptoms, optional history, medications and timeline, and the medical question. **Load Example Case** fills in a realistic sample.
- The form is checked in the browser with a Zod schema ([case-form.schema.ts](../apps/web/src/features/mca/demo/schemas/case-form.schema.ts)).
- On **Run AI Analysis**, `onSubmit` saves the form to `sessionStorage` (`saveCaseForm`) and navigates to `/mca/analysis`.

No API call happens yet. The case travels between pages through `sessionStorage`.

### 2. The analysis page starts the job

**Page:** `/mca/analysis`, which renders [analysis-view.tsx](../apps/web/src/app/mca/analysis/analysis-view.tsx).

- The page reads the case from `sessionStorage`. If there is none, it sends the user back to `/mca/case`.
- If a job is already in progress for this browser tab (`loadActiveAnalysis`), it **resumes** that job. This is why a page refresh does not start a second analysis.
- Otherwise it calls `submit()` from the hook [use-medical-analysis-job.ts](../apps/web/src/features/mca/demo/hooks/use-medical-analysis-job.ts), which sends:

```
POST {NEXT_PUBLIC_API_URL}/medical-analysis/jobs
Authorization: Bearer <token from login>
Content-Type: application/json

{ patientAge, patientGender, accidentDate, accidentType, accidentDescription,
  diagnosis, symptoms, medicalHistory, medications, timeline, medicalQuestion }
```

- On success, it stores `{ caseId, jobId }` with `saveActiveAnalysis` and starts tracking the job (step 5).

`apiFetch` in [lib/config/api.ts](../apps/web/src/lib/config/api.ts) adds the `Authorization` header from the token saved at login.

### 3. The API accepts the request and queues it

**Code:** [medical-analysis.controller.ts](../apps/api/src/modules/mca/medical-analysis/controllers/medical-analysis.controller.ts), then `enqueue()` in [medical-analysis-job.service.ts](../apps/api/src/modules/mca/medical-analysis/jobs/medical-analysis-job.service.ts).

Before the controller runs:

- **AccessGuard** (registered globally in `platform/auth/auth.module.ts`) rejects the request if the JWT is missing or invalid.
- **ValidationPipe** (in `main.ts`) checks the body against `AnalyzeMedicalCaseDto` and rejects unknown fields.

Then `enqueue()`:

1. Creates a `jobId` (UUID).
2. Inserts a row in **`cases.analysis_cases`** owned by the logged-in user, with status `queued`. This row is the permanent record and the one the history pages read.
3. Writes a fast-changing **job record** to Redis at `analysis:job:{jobId}` (status, step, progress, message). It expires after `JOB_STATE_TTL_SECONDS` / `ANALYSIS_JOB_TTL_SECONDS`.
4. Adds the job to the **BullMQ queue `medical-analysis`** in Redis. `attempts: 1` means a failed job is not retried automatically.
5. Returns **HTTP 202** with `{ caseId, jobId, status: "queued" }`.

The HTTP request ends here, after a fraction of a second. The analysis itself can take a minute or more, so it never runs inside the request.

### 4. The worker runs the analysis

**Code:** [medical-analysis.processor.ts](../apps/api/src/modules/mca/medical-analysis/jobs/medical-analysis.processor.ts), then `analyze()` in [medical-analysis.service.ts](../apps/api/src/modules/mca/medical-analysis/services/medical-analysis.service.ts).

The worker is part of the same API process (concurrency 1, so one analysis at a time). It marks the job `running` and calls `analyze()`. Each step below calls `onProgress`, which updates the Redis record, copies the status to `analysis_cases`, and pushes a `job:update` to the browser.

| Progress | Step (`step` id) | What happens |
|---|---|---|
| 12% | Intake (`intake`) | `MedicalQueryBuilder` turns the form into a retrieval request. |
| 28% | Private knowledge base (`private-kb`) | `RetrievalService.retrieve()` searches the indexed books. See "How the search works" below. |
| | Safety check | `validateRetrievalHasContext()`. If no passages were found, the job **fails** here with an insufficient-evidence message. |
| 45% | Evidence (`evidence`) | `AnalysisPromptBuilder` builds the system and user prompts from [causation-analysis.prompt.txt](../apps/api/src/ai/prompts/medical/causation-analysis.prompt.txt). Every passage gets a chunk ID, and the set of allowed IDs is remembered. |
| 62% | Reasoning (`reasoning`) | The LLM (`AI_PROVIDER`, currently Mistral) is asked for a JSON answer at temperature 0.2. The answer is parsed and **every cited chunk ID is checked against the allowed set**. An empty answer, broken JSON, or an invented citation triggers a retry with a corrective instruction, up to 5 attempts in total. |
| 82% | Summary (`summary`) | `responseMapper` turns the LLM output into the result shape. `ReportEnrichmentService` then adds the timeline, risk factors, private references with book and page, public references, and cross-examination questions. |
| 95% | Report (`report`) | Final assembly and logging. |
| 100% | Completed | `markCompleted()` stores the full result in the Redis record and in `analysis_cases.result` (JSON), then pushes the final `job:update` including the result. |

If any step throws, the worker calls `markFailed()`. The status becomes `failed` and the error message is shown on the analysis page.

#### How the search works

[retrieval.service.ts](../apps/api/src/modules/rag/services/retrieval.service.ts) and [hybrid-knowledge-base.retriever.ts](../apps/api/src/modules/rag/retrievers/hybrid-knowledge-base.retriever.ts):

1. The case fields are combined into one query text.
2. The query text is embedded with the same model used for indexing (`EMBEDDING_PROVIDER`, `AI_EMBEDDING_MODEL`).
3. Two searches run in parallel in PostgreSQL ([chunk-search.repository.ts](../apps/api/src/modules/rag/repositories/chunk-search.repository.ts)):
   - **Meaning search**: pgvector cosine distance (`embedding <=> query`). It keeps the top `RAG_VECTOR_TOP_K` results with similarity of at least `RAG_MIN_SIMILARITY_SCORE`.
   - **Keyword search**: PostgreSQL full-text search (`to_tsvector`, `plainto_tsquery`, `ts_rank`). It keeps the top `RAG_KEYWORD_TOP_K` results.
4. The two lists are merged with **Reciprocal Rank Fusion** (`RAG_RRF_K`). A passage that ranks well in both lists rises to the top.
5. A reranker (`RAG_RERANKER`) keeps the best `RAG_TOP_K` passages, and the context builder trims them to `RAG_MAX_CONTEXT_TOKENS`.

### 5. The browser follows progress

The hook in [use-medical-analysis-job.ts](../apps/web/src/features/mca/demo/hooks/use-medical-analysis-job.ts) uses two channels at once:

- **WebSocket (live):** it connects with socket.io to `{API}/medical-analysis`, sending the JWT, and emits `subscribe { jobId }`. The gateway ([medical-analysis.gateway.ts](../apps/api/src/modules/mca/medical-analysis/gateway/medical-analysis.gateway.ts)) checks the token on connect and checks that this user owns the case, then joins the socket to that job's room. Each step pushes a `job:update` event.
- **Polling (backup):** `GET /medical-analysis/jobs/:jobId` once right away and then every 4 seconds until the status is `completed` or `failed`. This endpoint also checks ownership. It reads the Redis job record.

Both channels feed the same `applyUpdate()` function, which drives the progress bar, step label, and message.

### 6. Showing the report

- When the status becomes `completed`, the page shows **View Report**.
- Clicking it (`openReport`) stores the result in `sessionStorage`, clears the "active job" marker, and goes to `/mca/histories/{caseId}`.
- [history-detail-view.tsx](../apps/web/src/app/mca/histories/[id]/history-detail-view.tsx) calls `GET /medical-analysis/histories/:id`. The API reads the row from `cases.analysis_cases`, checking ownership. If the row still says queued or running, it first syncs from the Redis record. The result JSON is returned and rendered on screen.
- `/mca/histories` lists the user's past cases from the same table, and a case can be deleted from there.

The report is on screen only. PDF download is listed as pending in [TODO.md](../TODO.md).

## Where the data lives

| Data | Where | Lifetime |
|---|---|---|
| Form values between pages | Browser `sessionStorage` | Until the tab closes |
| Live job state (status, step, progress, result) | Redis key `analysis:job:{jobId}` | Expires after the job TTL |
| Queue entry | Redis, BullMQ queue `medical-analysis` | Last 100 completed and 50 failed are kept |
| Case, status, and final result | PostgreSQL `cases.analysis_cases` | Permanent until deleted |
| Book passages and embeddings | `documents.document_chunks`, `vectors.chunk_embeddings` | Until re-indexed |

## Things to know

- **Public references are not live searches yet.** The PubMed, NIH, and similar entries in the report come from `simulatePublicReferences()` in [report-enrichment.helpers.ts](../apps/api/src/modules/mca/medical-analysis/services/report-enrichment.helpers.ts). It picks a fixed list based on keywords in the question. The "Searching Public Medical Literature" step label exists in the constants, but no code reports it.
- **Cross-examination questions are templates**, personalized with the question and diagnosis (`generateCrossExamination`). They are not written by the AI.
- **Only the private-library citations come from the AI**, and they are verified against the passages it was given.
- **A synchronous endpoint exists**: `POST /medical-analysis/analyze` runs the whole analysis inside one request. The website does not use it. It is useful for scripts and testing.
- **One job at a time.** Worker concurrency is 1, and PM2 runs a single API instance, so a second analysis waits in the queue.

## File map

| Layer | File |
|---|---|
| Case form | `apps/web/src/components/mca/demo/case-form.tsx` |
| Analysis page | `apps/web/src/app/mca/analysis/analysis-view.tsx` |
| Job hook (submit, WebSocket, polling) | `apps/web/src/features/mca/demo/hooks/use-medical-analysis-job.ts` |
| API client | `apps/web/src/features/mca/medical-analysis/medical-analysis.service.ts` |
| Report page | `apps/web/src/app/mca/histories/[id]/history-detail-view.tsx` |
| Controller | `apps/api/src/modules/mca/medical-analysis/controllers/medical-analysis.controller.ts` |
| Queue and job record | `apps/api/src/modules/mca/medical-analysis/jobs/medical-analysis-job.service.ts` |
| Worker | `apps/api/src/modules/mca/medical-analysis/jobs/medical-analysis.processor.ts` |
| Analysis pipeline | `apps/api/src/modules/mca/medical-analysis/services/medical-analysis.service.ts` |
| Report enrichment | `apps/api/src/modules/mca/medical-analysis/services/report-enrichment.service.ts` |
| History (Postgres) | `apps/api/src/modules/mca/medical-analysis/services/analysis-history.service.ts` |
| WebSocket gateway | `apps/api/src/modules/mca/medical-analysis/gateway/medical-analysis.gateway.ts` |
| Search | `apps/api/src/modules/rag/` |
| Indexing | `apps/api/src/modules/indexing/`, `apps/api/scripts/run-indexing.ts` |
| Prompt | `apps/api/src/ai/prompts/medical/causation-analysis.prompt.txt` |
