-- Optional National Provider Identifier the attorney supplied for an EWI
-- investigation. Used to confirm the expert in the NPI Registry.

ALTER TABLE ewi.investigations ADD COLUMN npi VARCHAR(10);
