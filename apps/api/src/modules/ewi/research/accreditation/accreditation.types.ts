/**
 * Per-degree university / APA program accreditation assessments.
 * Institutional (CHEA/USDE) and APA CoA program results stay distinct.
 */

export type AccreditationStatus =
  | 'accredited_during_period'
  | 'currently_accredited'
  | 'not_accredited_during_period'
  | 'no_matching_program'
  | 'unable_to_verify'
  | 'insufficient_education_details'
  | 'not_applicable';

export const ACCREDITATION_STATUS_LABEL: Record<AccreditationStatus, string> = {
  accredited_during_period: 'Accredited During Relevant Period',
  currently_accredited: 'Currently Accredited',
  not_accredited_during_period: 'Not Accredited During Relevant Period',
  no_matching_program: 'No Matching Program Found',
  unable_to_verify: 'Unable to Verify',
  insufficient_education_details: 'Insufficient Education Details',
  not_applicable: 'Not Applicable',
};

export type DegreeKind =
  | 'doctoral'
  | 'masters'
  | 'bachelors'
  | 'internship'
  | 'fellowship'
  | 'residency'
  | 'other'
  | 'unknown';

/** One education/training row taken from the CV (no invented fields). */
export interface EducationDegreeEntry {
  id: string;
  institution: string | null;
  degreeName: string | null;
  degreeKind: DegreeKind;
  program: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  graduationYear: number | null;
  campus: string | null;
  statement: string;
  quote: string;
  page: number | null;
  cvSourceUrl: string | null;
  claimId: string | null;
}

export type AccreditationKind = 'apa_program' | 'institutional';

export interface AccreditationSourceHit {
  kind: AccreditationKind;
  url: string;
  title: string | null;
  /** Raw snippet used for matching / date parse. */
  excerpt: string;
  retrievedAt: string;
  /** Accreditation effective start year when the page states one. */
  accreditedFromYear: number | null;
  /** Accreditation effective end year when the page states one. */
  accreditedToYear: number | null;
  /** True when the page asserts current accreditation without a usable period. */
  currentlyListed: boolean;
}

/** Result of checking one education entry against official sources. */
export interface ProgramAccreditationAssessment {
  id: string;
  entry: EducationDegreeEntry;
  apaStatus: AccreditationStatus;
  institutionalStatus: AccreditationStatus | null;
  apaEvidence: AccreditationSourceHit | null;
  institutionalEvidence: AccreditationSourceHit | null;
  queriesRun: string[];
  explanation: string;
  limitations: string[];
  retrievedAt: string;
}

export interface AccreditationDossier {
  assessedAt: string;
  assessments: ProgramAccreditationAssessment[];
  warnings: string[];
}
