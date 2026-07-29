# Frontend Demonstration UI

Phase 3+ delivers a polished demonstration frontend that walks attorneys through the real AI medical causation workflow with persistent case history.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — hero, features, workflow, technology highlights |
| `/case` | Medical case intake form with validation and example cases |
| `/analysis` | Background job processing with live WebSocket progress |
| `/histories` | List of all submitted cases with status and delete |
| `/histories/[id]` | Case detail — live progress, full report, delete |
| `/report` | Standalone report viewer (session-based fallback) |
| `/terms` | Terms of Use |
| `/privacy` | Privacy Policy |

## Client Demo Flow (Step by Step)

1. **Landing** (`/`) — Click **Start AI Demonstration**
2. **Case form** (`/case`) — Load example case or fill manually → accept Terms → **Run AI Analysis**
3. **Analysis** (`/analysis`) — Watch live progress steps (WebSocket + polling)
4. **History list** (`/histories`) — All cases saved in PostgreSQL; filter by status
5. **Case detail** (`/histories/[id]`) — Full report with PDF export and print
6. **Delete** — Delete button on list or detail page with confirmation dialog

See [DEMO_GUIDE.md](../DEMO_GUIDE.md) for the full client presentation script.

## Workflow (Technical)

1. User completes the medical case form (`/case`)
2. Form data is saved to `sessionStorage` and a background job is submitted via `POST /medical-analysis/jobs`
3. User is redirected to `/analysis` with live WebSocket progress
4. Case is persisted in PostgreSQL (`cases.analysis_cases`) on job enqueue
5. On completion, user opens the report from `/histories/{caseId}`
6. Report supports **Export PDF** and **Print** (with terms & policy footer)

## Form Validation

- **React Hook Form** for form state
- **Zod** schema in `apps/web/src/features/demo/schemas/case-form.schema.ts`
- Terms acknowledgment required before submission

## Optional Upload

The case form includes a drag-and-drop file uploader for PDF, DOCX, TXT, and MD files. Uploaded file names are displayed for demonstration only — files are **not** sent to the backend.

## API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/medical-analysis/jobs` | POST | Submit case for background analysis |
| `/medical-analysis/jobs/:jobId` | GET | Poll job status |
| `/medical-analysis/histories` | GET | List case history |
| `/medical-analysis/histories/:id` | GET | Case detail + report |
| `/medical-analysis/histories/:id` | DELETE | Delete case |
| WebSocket `/medical-analysis` | — | Live job progress |

Frontend client: `apps/web/src/features/medical-analysis/medical-analysis.service.ts`  
Job hook: `useMedicalAnalysisJob` in `features/demo/hooks/`

### Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

## Session Storage (Demo Only)

Browser `sessionStorage` keys (cleared after analysis completes):

| Key | Purpose |
|-----|---------|
| `mca:case-form` | Case form values between pages |
| `mca:active-analysis` | Current job ID while processing |
| `mca:analysis-result` | Last report for `/report` fallback |
| `mca:uploaded-files` | Uploaded file names (display only) |

Case history is stored in **PostgreSQL**, not browser storage.

## Reusable Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CaseForm` | `components/demo/case-form.tsx` | Full medical case intake form |
| `MedicalReport` | `components/report/medical-report.tsx` | Full analysis report with PDF export |
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | Delete confirmation modal |
| `ProgressTimeline` | `components/demo/progress-timeline.tsx` | Animated step timeline |
| `LoadingCard` | `components/demo/loading-card.tsx` | Progress card with title |

## Analysis Progress Steps

1. Preparing Medical Case
2. Searching Private Knowledge Base
3. Searching Public Medical Literature
4. Ranking Medical Sources
5. Medical Reasoning
6. Generating Statistical Summary
7. Cross-Examination Questions
8. Final Report

Progress updates via WebSocket events from the backend job processor.

## Not Yet Implemented

- Authentication / multi-tenant law firms
- Live PubMed / external literature APIs
- Admin panel
- File upload processing to knowledge base via UI

## Related Documentation

- [DEMO_GUIDE.md](../DEMO_GUIDE.md) — Client presentation script
- [Medical Analysis Engine](./medical-analysis.md)
- [RAG Workflow](./rag-workflow.md)
- [Indexing](./indexing.md)
