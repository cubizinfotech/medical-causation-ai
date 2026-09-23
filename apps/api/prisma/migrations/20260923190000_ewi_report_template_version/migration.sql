-- Report template identity is stored with the generated file, not with raw findings.

ALTER TABLE ewi.investigation_reports
    ADD COLUMN template_id TEXT NOT NULL DEFAULT 'ewi/investigation-report',
    ADD COLUMN template_version TEXT NOT NULL DEFAULT '1.0.0';
