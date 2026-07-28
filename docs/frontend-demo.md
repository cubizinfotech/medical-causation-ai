# Frontend Demonstration UI

Phase 3 delivers a polished demonstration frontend that walks attorneys through the real AI medical causation workflow.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — hero, features, workflow, technology highlights |
| `/case` | Medical case intake form with validation |
| `/analysis` | AI processing screen with animated progress and live API call |

> Screenshot placeholder: `docs/images/demo-landing.png`  
> Screenshot placeholder: `docs/images/demo-case-form.png`  
> Screenshot placeholder: `docs/images/demo-analysis.png`

## Workflow

1. User visits the landing page and clicks **Start AI Demonstration**
2. User completes the medical case form (`/case`)
3. Form data is saved to `sessionStorage` and the user is redirected to `/analysis`
4. The analysis page calls `POST /medical-analysis/analyze` on the real backend
5. Animated progress steps display while the RAG + LLM pipeline runs
6. On success, a summary preview shows confidence, conclusion, and evidence counts
7. On error, a friendly message appears with **Retry** and **Edit Case** actions

## Form Validation

- **React Hook Form** for form state
- **Zod** schema in `apps/web/src/features/demo/schemas/case-form.schema.ts`
- Clear inline error messages for each field

## Optional Upload

The case form includes a drag-and-drop file uploader for PDF, DOCX, TXT, and MD files. Uploaded file names are displayed for demonstration only — files are **not** sent to the backend in this phase.

## API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/medical-analysis/analyze` | POST | Run full RAG + LLM medical analysis |

Frontend client: `apps/web/src/features/medical-analysis/medical-analysis.service.ts`  
Request management: TanStack Query (`useMedicalAnalysis` hook)

### Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

## Reusable Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CaseForm` | `components/demo/case-form.tsx` | Full medical case intake form |
| `FileUploader` | `components/demo/file-uploader.tsx` | Optional document upload UI |
| `ProgressTimeline` | `components/demo/progress-timeline.tsx` | Animated step timeline |
| `LoadingCard` | `components/demo/loading-card.tsx` | Progress card with title |
| `InfoCard` | `components/demo/info-card.tsx` | Feature highlight card |
| `PageContainer` | `components/layout/page-container.tsx` | Responsive page wrapper |
| `SectionHeader` | `components/layout/section-header.tsx` | Section title + description |

## Analysis Progress Steps

1. Preparing Medical Case
2. Searching Knowledge Base
3. Searching Scientific Evidence
4. Ranking Medical Sources
5. Building Context
6. Analyzing Medical Literature
7. Generating Medical Reasoning
8. Preparing Professional Report

Progress animates based on elapsed time while the backend request is in flight.

## Not Implemented (By Design)

- PDF report page
- JSON export
- Dashboard
- Authentication
- Case history
- Admin panel

## Related Documentation

- [Medical Analysis Engine](./medical-analysis.md)
- [RAG Workflow](./rag-workflow.md)
- [Architecture](./architecture.md)
