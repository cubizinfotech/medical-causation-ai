-- EWI request/email workflow records.
-- Recipient addresses come from configuration or per-request input.
-- Credentials and passwords are never stored on these rows.

CREATE TYPE ewi."InvestigationRequestType" AS ENUM (
    'foia',
    'university_file',
    'graduation_announcement',
    'university_employment',
    'follow_up',
    'trialsmith'
);

CREATE TYPE ewi."InvestigationRequestStatus" AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'queued',
    'sent',
    'logged_not_sent',
    'failed',
    'cancelled',
    'needs_manual_review'
);

CREATE TABLE ewi.investigation_requests (
    id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    request_type ewi."InvestigationRequestType" NOT NULL,
    status ewi."InvestigationRequestStatus" NOT NULL DEFAULT 'draft',
    organization_name TEXT NOT NULL,
    recipient_email TEXT,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    template_id TEXT NOT NULL,
    case_reference TEXT NOT NULL,
    follow_up_at TIMESTAMP(3),
    parent_request_id UUID,
    approved_at TIMESTAMP(3),
    approved_by TEXT,
    sent_at TIMESTAMP(3),
    provider TEXT,
    provider_message_id TEXT,
    delivered BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT investigation_requests_pkey PRIMARY KEY (id)
);

ALTER TABLE ewi.investigation_requests
    ADD CONSTRAINT investigation_requests_investigation_id_fkey
    FOREIGN KEY (investigation_id) REFERENCES ewi.investigations(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE ewi.investigation_requests
    ADD CONSTRAINT investigation_requests_parent_request_id_fkey
    FOREIGN KEY (parent_request_id) REFERENCES ewi.investigation_requests(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX investigation_requests_investigation_id_idx
    ON ewi.investigation_requests(investigation_id);
CREATE INDEX investigation_requests_investigation_id_request_type_idx
    ON ewi.investigation_requests(investigation_id, request_type);
CREATE INDEX investigation_requests_status_idx
    ON ewi.investigation_requests(status);
CREATE INDEX investigation_requests_follow_up_at_idx
    ON ewi.investigation_requests(follow_up_at);
