-- Free OpenRouter embedding model (nvidia/nemotron-3-embed-1b:free) outputs 2048 dimensions.
-- pgvector ivfflat indexes support at most 2000 dimensions, so drop the index first.
-- Existing 1536-dim vectors are incompatible; clear and resize the column.
DELETE FROM vectors.chunk_embeddings;

DROP INDEX IF EXISTS vectors.chunk_embeddings_embedding_idx;

ALTER TABLE vectors.chunk_embeddings
  ALTER COLUMN embedding TYPE vector(2048);

-- Sequential scan is fine for demo-scale knowledge bases (< few thousand chunks).
