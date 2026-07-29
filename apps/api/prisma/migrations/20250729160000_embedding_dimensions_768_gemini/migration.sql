-- Switch to Gemini gemini-embedding-2 with 768 output dimensions (recommended size).
-- Existing 2048-dim vectors are incompatible; clear and resize the column.
DELETE FROM vectors.chunk_embeddings;

DROP INDEX IF EXISTS vectors.chunk_embeddings_embedding_idx;

ALTER TABLE vectors.chunk_embeddings
  ALTER COLUMN embedding TYPE vector(768);

-- ivfflat index is supported at 768 dimensions for larger knowledge bases.
CREATE INDEX IF NOT EXISTS chunk_embeddings_embedding_idx
  ON vectors.chunk_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
