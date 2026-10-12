-- Audit trail for access to case data and sign-ins.
CREATE TABLE platform.audit_events (
    id UUID NOT NULL,
    product TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID,
    resource_type TEXT,
    resource_id TEXT,
    metadata JSONB,
    occurred_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_events_pkey PRIMARY KEY (id)
);
CREATE INDEX audit_events_actor_id_occurred_at_idx
    ON platform.audit_events (actor_id, occurred_at DESC);
CREATE INDEX audit_events_resource_type_resource_id_idx
    ON platform.audit_events (resource_type, resource_id);

-- Keyword retrieval filters on to_tsvector('english', text); without this
-- index every search scans and parses every chunk.
CREATE INDEX IF NOT EXISTS document_chunks_text_search_idx
    ON documents.document_chunks USING GIN (to_tsvector('english', text));
