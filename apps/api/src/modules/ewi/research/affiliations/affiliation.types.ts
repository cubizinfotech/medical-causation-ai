/**
 * Institutional relationship assessments: appointments vs training/practicum.
 * Distinct from degrees, memberships, board certifications, and corporate orgs.
 */

export type InstitutionalRelationshipType =
  | 'academic_appointment'
  | 'faculty_appointment'
  | 'clinical_appointment'
  | 'adjunct_visiting_faculty'
  | 'teaching_appointment'
  | 'research_appointment'
  | 'hospital_staff_appointment'
  | 'professional_affiliation'
  | 'practicum_placement'
  | 'internship'
  | 'residency_fellowship_training'
  | 'educational_institution'
  | 'historical_appointment'
  | 'self_reported_affiliation'
  | 'unconfirmed_institutional_reference';

export const RELATIONSHIP_TYPE_LABEL: Record<
  InstitutionalRelationshipType,
  string
> = {
  academic_appointment: 'Academic Appointment',
  faculty_appointment: 'Faculty Appointment',
  clinical_appointment: 'Clinical Appointment',
  adjunct_visiting_faculty: 'Adjunct or Visiting Faculty',
  teaching_appointment: 'Teaching Appointment',
  research_appointment: 'Research Appointment',
  hospital_staff_appointment: 'Hospital or Clinical Staff Appointment',
  professional_affiliation: 'Professional or Organizational Affiliation',
  practicum_placement: 'Practicum Placement',
  internship: 'Internship',
  residency_fellowship_training: 'Residency or Fellowship Training',
  educational_institution: 'Educational Institution',
  historical_appointment: 'Historical Appointment',
  self_reported_affiliation: 'Self-Reported Affiliation',
  unconfirmed_institutional_reference: 'Unconfirmed Institutional Reference',
};

export type AffiliationVerificationStatus =
  | 'independently_verified'
  | 'partially_verified'
  | 'self_reported'
  | 'not_independently_verified'
  | 'historical_appointment_verified'
  | 'training_or_practicum_confirmed'
  | 'potential_match_unconfirmed'
  | 'unable_to_access'
  | 'no_matching_record'
  | 'not_checked';

export const AFFILIATION_STATUS_LABEL: Record<
  AffiliationVerificationStatus,
  string
> = {
  independently_verified: 'Independently Verified',
  partially_verified: 'Partially Verified',
  self_reported: 'Self-Reported',
  not_independently_verified: 'Not Independently Verified',
  historical_appointment_verified: 'Historical Appointment Verified',
  training_or_practicum_confirmed: 'Training or Practicum Confirmed',
  potential_match_unconfirmed: 'Potential Match – Identity Unconfirmed',
  unable_to_access: 'Unable to Access',
  no_matching_record: 'No Matching Record',
  not_checked: 'Not Checked',
};

export type AffiliationTimeframe = 'current' | 'historical' | 'undated' | 'unknown';

/** One institutional relationship row from the CV (no invented fields). */
export interface AffiliationEntry {
  id: string;
  institution: string | null;
  department: string | null;
  title: string | null;
  relationshipType: InstitutionalRelationshipType;
  timeframe: AffiliationTimeframe;
  startYear: number | null;
  endYear: number | null;
  location: string | null;
  statement: string;
  quote: string;
  page: number | null;
  cvSourceUrl: string | null;
  claimId: string | null;
  /** Appointment-class vs training-class for routing/assessment. */
  class: 'appointment' | 'training';
  extractionConfidence: 'high' | 'medium' | 'low';
}

export interface AffiliationSourceHit {
  url: string;
  title: string | null;
  excerpt: string;
  retrievedAt: string;
  host: string;
  identityLevel: 'strong' | 'possible' | 'weak' | 'none';
  searchResultOnly: boolean;
  /** True when the page is a practicum/training brochure rather than faculty roster. */
  trainingDocument: boolean;
}

export interface AffiliationAssessment {
  id: string;
  entry: AffiliationEntry;
  status: AffiliationVerificationStatus;
  institutionCanonical: string | null;
  evidence: AffiliationSourceHit | null;
  queriesRun: string[];
  explanation: string;
  limitations: string[];
  retrievedAt: string;
}

export interface AffiliationDossier {
  assessedAt: string;
  assessments: AffiliationAssessment[];
  warnings: string[];
}
