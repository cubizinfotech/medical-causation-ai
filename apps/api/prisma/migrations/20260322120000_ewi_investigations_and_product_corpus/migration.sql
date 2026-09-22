-- EWI schema + product corpus on indexed documents

CREATE SCHEMA IF NOT EXISTS ewi;

DO $$
BEGIN
  IF current_user IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SCHEMA ewi TO %I', current_user);
    EXECUTE format('GRANT CREATE ON SCHEMA ewi TO %I', current_user);
  END IF;
END $$;

CREATE TYPE documents."ProductCorpus" AS ENUM ('mca', 'ewi');

ALTER TABLE documents.indexed_documents
  ADD COLUMN IF NOT EXISTS "product" documents."ProductCorpus" NOT NULL DEFAULT 'mca';

CREATE INDEX IF NOT EXISTS indexed_documents_product_idx
  ON documents.indexed_documents("product");

CREATE TYPE ewi."InvestigationStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

CREATE TABLE ewi.expert_investigations (
    "id" UUID NOT NULL,
    "job_id" TEXT NOT NULL,
    "expert_name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "status" ewi."InvestigationStatus" NOT NULL DEFAULT 'queued',
    "step" TEXT,
    "step_label" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error_message" TEXT,
    "result" JSONB,
    "report_file_name" TEXT,
    "report_mime_type" TEXT,
    "report_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT expert_investigations_pkey PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX expert_investigations_job_id_key ON ewi.expert_investigations("job_id");
CREATE INDEX expert_investigations_status_idx ON ewi.expert_investigations("status");
CREATE INDEX expert_investigations_created_at_idx ON ewi.expert_investigations("created_at" DESC);
CREATE INDEX expert_investigations_expert_name_idx ON ewi.expert_investigations("expert_name");
