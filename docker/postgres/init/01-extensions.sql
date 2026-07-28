-- Medical Causation AI — PostgreSQL initialization
-- Enables extensions required for AI workloads and RAG vector search.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
