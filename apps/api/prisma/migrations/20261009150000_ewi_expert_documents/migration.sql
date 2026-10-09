-- Documents the attorney uploads for an EWI investigation (the expert's CV).

CREATE TABLE ewi.expert_documents (
    id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    investigation_id UUID,
    kind TEXT NOT NULL,
    original_name TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    unreadable_pages INTEGER[],
    ocr_pages INTEGER[] NOT NULL DEFAULT '{}',
    ocr_completed_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expert_documents_pkey PRIMARY KEY (id),
    CONSTRAINT expert_documents_investigation_id_fkey FOREIGN KEY (investigation_id)
        REFERENCES ewi.investigations(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX expert_documents_owner_user_id_created_at_idx
    ON ewi.expert_documents (owner_user_id, created_at DESC);
CREATE INDEX expert_documents_investigation_id_idx
    ON ewi.expert_documents (investigation_id);

CREATE TABLE ewi.expert_document_pages (
    document_id UUID NOT NULL,
    page_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    ocr_confidence INTEGER,
    CONSTRAINT expert_document_pages_pkey PRIMARY KEY (document_id, page_number),
    CONSTRAINT expert_document_pages_document_id_fkey FOREIGN KEY (document_id)
        REFERENCES ewi.expert_documents(id) ON DELETE CASCADE ON UPDATE CASCADE
);
