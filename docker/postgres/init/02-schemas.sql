-- Medical Causation AI — Schema preparation
-- Creates logical schemas for future application tables.
-- No application tables are created in this phase.

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS documents;
CREATE SCHEMA IF NOT EXISTS vectors;

COMMENT ON SCHEMA app IS 'Application data: cases, users, law firms, reports';
COMMENT ON SCHEMA documents IS 'Document metadata, ingestion records, and chunk references';
COMMENT ON SCHEMA vectors IS 'Vector embeddings and similarity search indexes for RAG';

-- Grant usage to the application database user (created by POSTGRES_USER)
DO $$
BEGIN
  IF current_user IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SCHEMA app TO %I', current_user);
    EXECUTE format('GRANT USAGE ON SCHEMA documents TO %I', current_user);
    EXECUTE format('GRANT USAGE ON SCHEMA vectors TO %I', current_user);
    EXECUTE format('GRANT CREATE ON SCHEMA app TO %I', current_user);
    EXECUTE format('GRANT CREATE ON SCHEMA documents TO %I', current_user);
    EXECUTE format('GRANT CREATE ON SCHEMA vectors TO %I', current_user);
  END IF;
END $$;
