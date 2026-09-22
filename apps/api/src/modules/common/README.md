# Common Nest modules (document / RAG pipeline)

These modules are **shared infrastructure**, not MCA or EWI domain logic:

- `modules/knowledge-base`
- `modules/document-processing`
- `modules/indexing`
- `modules/rag`

`CommonModule` re-exports them for a clear composition root. Do not put product
DTOs, prompts, or report workflows here.
