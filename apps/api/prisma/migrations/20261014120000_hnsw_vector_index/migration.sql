-- The ivfflat index was created right after its table was emptied, so its
-- list centroids were random. Searched with pgvector's default single probe,
-- it returned only 1 to 3 of the true 20 nearest passages. HNSW needs no
-- training data and keeps its recall as passages are added.
DROP INDEX IF EXISTS vectors.chunk_embeddings_embedding_idx;

CREATE INDEX IF NOT EXISTS chunk_embeddings_embedding_idx
  ON vectors.chunk_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Vector search filters on the embedding model, and re-embedding looks for
-- vectors made by an older model.
CREATE INDEX IF NOT EXISTS chunk_embeddings_provider_model_idx
  ON vectors.chunk_embeddings (provider, model);
