-- Primary investigation input is expert name, city, and medical specialty.
-- Collected items keep source metadata on the existing findings and sources tables.
-- Inconsistencies stay on discrepancies. Questions and the Word report are unchanged.
-- Existing experts were saved before city was collected, so their city is blank.
-- Restricted rows keep a link and metadata. Document bodies and LexisNexis PDFs are not copied.

CREATE TYPE ewi."EvidenceStatus" AS ENUM ('recorded', 'metadata_only', 'unavailable');

CREATE TYPE ewi."EwiEvidenceCategory" AS ENUM (
    'identity_profile',
    'location',
    'specialty',
    'cv',
    'education',
    'university',
    'license',
    'state_license',
    'board_certification',
    'certification_organization',
    'membership',
    'publication',
    'grant',
    'patent',
    'award',
    'military',
    'legal_case',
    'court_order',
    'motion',
    'deposition',
    'testimony',
    'directory',
    'website',
    'ime',
    'advertising',
    'video',
    'presentation',
    'powerpoint',
    'social',
    'news',
    'university_rules',
    'income_bias',
    'patient_review',
    'office',
    'corporate_affiliation',
    'criminal_record',
    'malpractice',
    'foia_request',
    'university_request',
    'graduation_request',
    'research_finding'
);

ALTER TABLE ewi.experts ADD COLUMN city TEXT;
UPDATE ewi.experts SET city = '' WHERE city IS NULL;
ALTER TABLE ewi.experts ALTER COLUMN city SET NOT NULL;

DROP INDEX ewi.experts_name_specialty_key;
CREATE UNIQUE INDEX experts_name_city_specialty_key ON ewi.experts(name, city, specialty);
CREATE INDEX experts_city_idx ON ewi.experts(city);
CREATE INDEX experts_specialty_idx ON ewi.experts(specialty);

ALTER TABLE ewi.expert_profiles ADD COLUMN city TEXT;
UPDATE ewi.expert_profiles AS profile
SET city = expert.city
FROM ewi.investigations AS investigation
JOIN ewi.experts AS expert ON expert.id = investigation.expert_id
WHERE profile.investigation_id = investigation.id
  AND profile.city IS NULL;
UPDATE ewi.expert_profiles SET city = '' WHERE city IS NULL;
ALTER TABLE ewi.expert_profiles ALTER COLUMN city SET NOT NULL;
CREATE INDEX expert_profiles_city_idx ON ewi.expert_profiles(city);

ALTER TABLE ewi.research_sources
    ADD COLUMN retrieved_at TIMESTAMP(3),
    ADD COLUMN evidence_status ewi."EvidenceStatus" NOT NULL DEFAULT 'recorded',
    ADD COLUMN restriction_note TEXT;

UPDATE ewi.research_sources
SET
    evidence_status = 'metadata_only',
    restriction_note = 'Metadata only. Source license does not permit storing content. LexisNexis PDFs are not stored.'
WHERE restricted = true;

CREATE INDEX research_sources_evidence_status_idx ON ewi.research_sources(evidence_status);

ALTER TABLE ewi.research_findings
    ADD COLUMN category ewi."EwiEvidenceCategory",
    ADD COLUMN source_name TEXT,
    ADD COLUMN retrieved_at TIMESTAMP(3),
    ADD COLUMN relevant_dates TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
    ADD COLUMN evidence_status ewi."EvidenceStatus" NOT NULL DEFAULT 'recorded',
    ADD COLUMN restricted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN attributes JSONB;

UPDATE ewi.research_findings AS finding
SET
    source_name = source.name,
    restricted = source.restricted,
    evidence_status = CASE
        WHEN source.restricted THEN 'metadata_only'::ewi."EvidenceStatus"
        ELSE 'recorded'::ewi."EvidenceStatus"
    END,
    category = CASE lower(finding.source_type)
        WHEN 'profile' THEN 'identity_profile'::ewi."EwiEvidenceCategory"
        WHEN 'identity' THEN 'identity_profile'::ewi."EwiEvidenceCategory"
        WHEN 'identity_profile' THEN 'identity_profile'::ewi."EwiEvidenceCategory"
        WHEN 'location' THEN 'location'::ewi."EwiEvidenceCategory"
        WHEN 'city' THEN 'location'::ewi."EwiEvidenceCategory"
        WHEN 'specialty' THEN 'specialty'::ewi."EwiEvidenceCategory"
        WHEN 'cv' THEN 'cv'::ewi."EwiEvidenceCategory"
        WHEN 'education' THEN 'education'::ewi."EwiEvidenceCategory"
        WHEN 'degree' THEN 'education'::ewi."EwiEvidenceCategory"
        WHEN 'university' THEN 'university'::ewi."EwiEvidenceCategory"
        WHEN 'license' THEN 'license'::ewi."EwiEvidenceCategory"
        WHEN 'state_license' THEN 'state_license'::ewi."EwiEvidenceCategory"
        WHEN 'publication' THEN 'publication'::ewi."EwiEvidenceCategory"
        WHEN 'grant' THEN 'grant'::ewi."EwiEvidenceCategory"
        WHEN 'patent' THEN 'patent'::ewi."EwiEvidenceCategory"
        WHEN 'award' THEN 'award'::ewi."EwiEvidenceCategory"
        WHEN 'legal' THEN 'legal_case'::ewi."EwiEvidenceCategory"
        WHEN 'legal_case' THEN 'legal_case'::ewi."EwiEvidenceCategory"
        WHEN 'directory' THEN 'directory'::ewi."EwiEvidenceCategory"
        WHEN 'video' THEN 'video'::ewi."EwiEvidenceCategory"
        WHEN 'news' THEN 'news'::ewi."EwiEvidenceCategory"
        WHEN 'social' THEN 'social'::ewi."EwiEvidenceCategory"
        ELSE 'research_finding'::ewi."EwiEvidenceCategory"
    END,
    relevant_dates = CASE
        WHEN finding.published_at IS NULL THEN ARRAY[]::TIMESTAMP(3)[]
        ELSE ARRAY[finding.published_at]
    END,
    summary = CASE WHEN source.restricted THEN NULL ELSE finding.summary END
FROM ewi.research_sources AS source
WHERE finding.source_id = source.id;

UPDATE ewi.research_findings
SET
    category = 'research_finding',
    source_name = 'unknown'
WHERE category IS NULL OR source_name IS NULL;

ALTER TABLE ewi.research_findings ALTER COLUMN category SET NOT NULL;
ALTER TABLE ewi.research_findings ALTER COLUMN source_name SET NOT NULL;

CREATE INDEX research_findings_category_idx ON ewi.research_findings(category);
CREATE INDEX research_findings_investigation_id_category_idx
    ON ewi.research_findings(investigation_id, category);
CREATE INDEX research_findings_evidence_status_idx ON ewi.research_findings(evidence_status);

ALTER TABLE ewi.discrepancies
    ADD COLUMN source_type TEXT,
    ADD COLUMN source_name TEXT,
    ADD COLUMN source_url TEXT,
    ADD COLUMN retrieved_at TIMESTAMP(3),
    ADD COLUMN relevant_dates TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
    ADD COLUMN evidence_status ewi."EvidenceStatus" NOT NULL DEFAULT 'recorded',
    ADD COLUMN verification_status ewi."VerificationStatus" NOT NULL DEFAULT 'unverified',
    ADD COLUMN restricted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN notes TEXT;

CREATE INDEX discrepancies_evidence_status_idx ON ewi.discrepancies(evidence_status);
