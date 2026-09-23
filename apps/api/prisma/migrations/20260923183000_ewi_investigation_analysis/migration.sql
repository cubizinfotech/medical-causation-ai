-- AI interpretation is stored separately from collected research findings.

CREATE TABLE ewi.investigation_analyses (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    origin TEXT NOT NULL,
    provider_name TEXT,
    schema_version TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT investigation_analyses_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX investigation_analyses_investigation_id_key
    ON ewi.investigation_analyses(investigation_id);

ALTER TABLE ewi.investigation_analyses
    ADD CONSTRAINT investigation_analyses_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id) ON DELETE CASCADE;
