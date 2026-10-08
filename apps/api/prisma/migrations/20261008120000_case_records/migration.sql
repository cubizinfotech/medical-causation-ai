-- Client medical records uploaded for MCA cases, and their page text.

CREATE TABLE cases.case_records (
    id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    case_id UUID,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    unreadable_pages INTEGER[],
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT case_records_pkey PRIMARY KEY (id),
    CONSTRAINT case_records_case_id_fkey FOREIGN KEY (case_id)
        REFERENCES cases.analysis_cases(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX case_records_owner_user_id_created_at_idx
    ON cases.case_records(owner_user_id, created_at DESC);
CREATE INDEX case_records_case_id_idx ON cases.case_records(case_id);

CREATE TABLE cases.case_record_pages (
    record_id UUID NOT NULL,
    page_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    bates_numbers TEXT[],
    CONSTRAINT case_record_pages_pkey PRIMARY KEY (record_id, page_number),
    CONSTRAINT case_record_pages_record_id_fkey FOREIGN KEY (record_id)
        REFERENCES cases.case_records(id) ON DELETE CASCADE ON UPDATE CASCADE
);
