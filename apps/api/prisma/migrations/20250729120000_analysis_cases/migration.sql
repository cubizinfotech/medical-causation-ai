CREATE SCHEMA IF NOT EXISTS cases;

CREATE TYPE cases."AnalysisCaseStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

CREATE TABLE cases.analysis_cases (
    "id" UUID NOT NULL,
    "job_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_age" TEXT NOT NULL,
    "patient_gender" TEXT NOT NULL,
    "accident_date" TEXT NOT NULL,
    "accident_type" TEXT NOT NULL,
    "accident_description" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "medical_history" TEXT,
    "medications" TEXT,
    "timeline" TEXT,
    "medical_question" TEXT NOT NULL,
    "status" cases."AnalysisCaseStatus" NOT NULL DEFAULT 'queued',
    "step" TEXT,
    "step_label" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error_message" TEXT,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT analysis_cases_pkey PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX analysis_cases_job_id_key ON cases.analysis_cases("job_id");
CREATE INDEX analysis_cases_status_idx ON cases.analysis_cases("status");
CREATE INDEX analysis_cases_created_at_idx ON cases.analysis_cases("created_at" DESC);
