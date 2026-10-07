-- Self-service profile details and a small profile photo.

ALTER TABLE platform.users
    ADD COLUMN job_title TEXT,
    ADD COLUMN organization TEXT,
    ADD COLUMN phone TEXT,
    ADD COLUMN location TEXT,
    ADD COLUMN bio TEXT,
    ADD COLUMN avatar_data BYTEA,
    ADD COLUMN avatar_mime_type TEXT,
    ADD COLUMN avatar_updated_at TIMESTAMP(3);
