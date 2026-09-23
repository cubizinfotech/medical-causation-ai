-- Replace the single EWI blob table with an investigation lifecycle.
-- queued -> pending. Third-party report bytes are not copied.

CREATE TYPE ewi."VerificationStatus" AS ENUM ('unverified', 'verified', 'disputed');
CREATE TYPE ewi."InvestigationStatus_new" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE ewi.experts (
    id UUID NOT NULL,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT experts_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX experts_name_specialty_key ON ewi.experts(name, specialty);
CREATE INDEX experts_name_idx ON ewi.experts(name);

INSERT INTO ewi.experts (id, name, specialty, created_at, updated_at)
SELECT gen_random_uuid(), expert_name, specialty, MIN(created_at), MAX(updated_at)
FROM ewi.expert_investigations
GROUP BY expert_name, specialty;

CREATE TABLE ewi.investigations (
    id UUID NOT NULL,
    expert_id UUID NOT NULL,
    job_id TEXT NOT NULL,
    status ewi."InvestigationStatus_new" NOT NULL DEFAULT 'pending',
    current_stage TEXT,
    stage_label TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    error_message TEXT,
    notes TEXT,
    started_at TIMESTAMP(3),
    completed_at TIMESTAMP(3),
    cancelled_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT investigations_pkey PRIMARY KEY (id)
);

INSERT INTO ewi.investigations (
    id, expert_id, job_id, status, current_stage, stage_label, progress,
    message, error_message, started_at, completed_at, created_at, updated_at
)
SELECT
    ei.id,
    e.id,
    ei.job_id,
    CASE ei.status::text
        WHEN 'queued' THEN 'pending'::ewi."InvestigationStatus_new"
        WHEN 'running' THEN 'running'::ewi."InvestigationStatus_new"
        WHEN 'completed' THEN 'completed'::ewi."InvestigationStatus_new"
        WHEN 'failed' THEN 'failed'::ewi."InvestigationStatus_new"
        ELSE 'pending'::ewi."InvestigationStatus_new"
    END,
    ei.step,
    ei.step_label,
    ei.progress,
    ei.message,
    ei.error_message,
    CASE
        WHEN ei.status::text IN ('running', 'completed', 'failed') THEN ei.created_at
        ELSE NULL
    END,
    ei.completed_at,
    ei.created_at,
    ei.updated_at
FROM ewi.expert_investigations ei
JOIN ewi.experts e ON e.name = ei.expert_name AND e.specialty = ei.specialty;

DROP TABLE ewi.expert_investigations;
DROP TYPE ewi."InvestigationStatus";
ALTER TYPE ewi."InvestigationStatus_new" RENAME TO "InvestigationStatus";

CREATE UNIQUE INDEX investigations_job_id_key ON ewi.investigations(job_id);
CREATE INDEX investigations_status_idx ON ewi.investigations(status);
CREATE INDEX investigations_expert_id_idx ON ewi.investigations(expert_id);
CREATE INDEX investigations_created_at_idx ON ewi.investigations(created_at DESC);

ALTER TABLE ewi.investigations
    ADD CONSTRAINT investigations_expert_id_fkey
    FOREIGN KEY (expert_id) REFERENCES ewi.experts(id);

CREATE TABLE ewi.expert_profiles (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    display_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expert_profiles_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX expert_profiles_investigation_id_key ON ewi.expert_profiles(investigation_id);
ALTER TABLE ewi.expert_profiles
    ADD CONSTRAINT expert_profiles_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;

INSERT INTO ewi.expert_profiles (id, investigation_id, display_name, specialty, created_at, updated_at)
SELECT gen_random_uuid(), i.id, e.name, e.specialty, i.created_at, i.updated_at
FROM ewi.investigations i
JOIN ewi.experts e ON e.id = i.expert_id;

CREATE TABLE ewi.research_sources (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    source_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    published_at TIMESTAMP(3),
    restricted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT research_sources_pkey PRIMARY KEY (id)
);

CREATE INDEX research_sources_investigation_id_idx ON ewi.research_sources(investigation_id);
CREATE INDEX research_sources_provider_idx ON ewi.research_sources(provider);
ALTER TABLE ewi.research_sources
    ADD CONSTRAINT research_sources_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;

CREATE TABLE ewi.research_findings (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    source_id UUID NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    source_type TEXT NOT NULL,
    published_at TIMESTAMP(3),
    verification_status ewi."VerificationStatus" NOT NULL DEFAULT 'unverified',
    notes TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT research_findings_pkey PRIMARY KEY (id)
);

CREATE INDEX research_findings_investigation_id_idx ON ewi.research_findings(investigation_id);
CREATE INDEX research_findings_verification_status_idx ON ewi.research_findings(verification_status);
ALTER TABLE ewi.research_findings
    ADD CONSTRAINT research_findings_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;
ALTER TABLE ewi.research_findings
    ADD CONSTRAINT research_findings_source_id_fkey
    FOREIGN KEY (source_id) REFERENCES ewi.research_sources(id) ON DELETE CASCADE;

CREATE TABLE ewi.discrepancies (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    related_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT discrepancies_pkey PRIMARY KEY (id)
);

CREATE INDEX discrepancies_investigation_id_idx ON ewi.discrepancies(investigation_id);
ALTER TABLE ewi.discrepancies
    ADD CONSTRAINT discrepancies_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;

CREATE TABLE ewi.cross_exam_questions (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    number INTEGER NOT NULL,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    evidence_basis TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cross_exam_questions_pkey PRIMARY KEY (id)
);

CREATE INDEX cross_exam_questions_investigation_id_number_idx
    ON ewi.cross_exam_questions(investigation_id, number);
ALTER TABLE ewi.cross_exam_questions
    ADD CONSTRAINT cross_exam_questions_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;

CREATE TABLE ewi.investigation_reports (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    generated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT investigation_reports_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX investigation_reports_investigation_id_key
    ON ewi.investigation_reports(investigation_id);
ALTER TABLE ewi.investigation_reports
    ADD CONSTRAINT investigation_reports_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;

CREATE TABLE ewi.investigation_events (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    status ewi."InvestigationStatus",
    stage TEXT,
    message TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT investigation_events_pkey PRIMARY KEY (id)
);

CREATE INDEX investigation_events_investigation_id_created_at_idx
    ON ewi.investigation_events(investigation_id, created_at);
ALTER TABLE ewi.investigation_events
    ADD CONSTRAINT investigation_events_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;
