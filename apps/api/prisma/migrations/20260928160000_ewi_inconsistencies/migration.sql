-- Inconsistencies stay on ewi.discrepancies.
-- The label records the evidence comparison. It does not assert that a statement is fraudulent.
-- CV comparison columns keep the later CV date, the values, and the supporting source.
-- evidence keeps the source statements used for that row.

CREATE TYPE ewi."InconsistencyLabel" AS ENUM (
    'verified',
    'partially_verified',
    'conflicting',
    'not_verified',
    'not_found',
    'unable_to_verify'
);

ALTER TABLE ewi.discrepancies
    ADD COLUMN label ewi."InconsistencyLabel" NOT NULL DEFAULT 'not_verified',
    ADD COLUMN field TEXT,
    ADD COLUMN previous_value TEXT,
    ADD COLUMN current_value TEXT,
    ADD COLUMN change_text TEXT,
    ADD COLUMN cv_date TEXT,
    ADD COLUMN cv_source TEXT,
    ADD COLUMN supporting_source TEXT,
    ADD COLUMN priority INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN evidence JSONB;

CREATE INDEX discrepancies_investigation_id_priority_idx
    ON ewi.discrepancies (investigation_id, priority);

CREATE INDEX discrepancies_label_idx ON ewi.discrepancies (label);
