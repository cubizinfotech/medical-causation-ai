-- Free text the attorney can add to an EWI investigation: aliases, employers,
-- case names. Used by the global web search to tell same-name people apart.
-- Additive and nullable: existing investigations are untouched.

ALTER TABLE ewi.investigations ADD COLUMN additional_context TEXT;
