export const INCONSISTENCY_LABELS = [
  'verified',
  'partially_verified',
  'conflicting',
  'not_verified',
  'not_found',
  'unable_to_verify',
] as const;

export type InconsistencyLabel = (typeof INCONSISTENCY_LABELS)[number];

export const INCONSISTENCY_LABEL_TEXT: Record<InconsistencyLabel, string> = {
  verified: 'Verified',
  partially_verified: 'Partially Verified',
  conflicting: 'Conflicting',
  not_verified: 'Not Verified',
  not_found: 'Not Found',
  unable_to_verify: 'Unable to Verify',
};

export const VERIFICATION_FIELDS = [
  'cv',
  'education',
  'degree_date',
  'graduation_date',
  'university',
  'university_accreditation',
  'license',
  'license_date',
  'license_status',
  'board_certification',
  'certification_organization',
  'membership',
  'publication',
  'authorship',
  'lead_author',
  'grant',
  'patent',
  'award',
  'military',
  'employment',
  'university_affiliation',
  'corporate_affiliation',
  'specialty',
] as const;

export type VerificationField = (typeof VERIFICATION_FIELDS)[number];

export const FIELD_LABEL: Record<VerificationField, string> = {
  cv: 'CV',
  education: 'Education',
  degree_date: 'Degree date',
  graduation_date: 'Graduation date',
  university: 'University',
  university_accreditation: 'University accreditation',
  license: 'License',
  license_date: 'License date',
  license_status: 'License status',
  board_certification: 'Board certification',
  certification_organization: 'Certification organization',
  membership: 'Membership',
  publication: 'Publication',
  authorship: 'Authorship',
  lead_author: 'First or lead author',
  grant: 'Grant',
  patent: 'Patent',
  award: 'Award',
  military: 'Military or medal claim',
  employment: 'Employment',
  university_affiliation: 'University affiliation',
  corporate_affiliation: 'Corporate affiliation',
  specialty: 'Specialty',
};

/** Providers that can confirm a field. An empty list means no catalog source checks it. */
export const CONFIRMING_PROVIDERS: Record<
  VerificationField,
  readonly string[]
> = {
  cv: ['cv_profile'],
  education: ['education_verification'],
  degree_date: ['education_verification'],
  graduation_date: ['education_verification'],
  university: ['education_verification', 'university'],
  university_accreditation: ['university_accreditation'],
  license: ['state_license', 'state_discipline'],
  license_date: ['state_license'],
  license_status: ['state_license', 'state_discipline'],
  board_certification: ['board_certification'],
  certification_organization: ['certification_organization'],
  membership: ['memberships', 'professional_organizations'],
  publication: ['pubmed', 'crossref', 'openalex'],
  authorship: ['author_verification'],
  lead_author: ['lead_author_verification', 'author_verification'],
  grant: ['grants', 'grant_results'],
  patent: ['patents'],
  award: ['awards'],
  military: ['military_claims'],
  employment: ['cv_profile'],
  university_affiliation: ['university'],
  corporate_affiliation: ['corporate_affiliations'],
  specialty: ['cv_profile'],
};

const FIELD_SET = new Set<string>(VERIFICATION_FIELDS);

export function isVerificationField(value: string): value is VerificationField {
  return FIELD_SET.has(value);
}

const MULTI_VALUE_FIELDS = new Set<VerificationField>([
  'license',
  'license_date',
  'license_status',
  'publication',
  'authorship',
  'lead_author',
  'grant',
  'patent',
  'award',
  'military',
  'membership',
  'employment',
  'university_affiliation',
  'corporate_affiliation',
]);

export function defaultSubject(
  field: VerificationField,
  value: string,
): string {
  return MULTI_VALUE_FIELDS.has(field) ? value : field;
}

const DATE_FIELDS = new Set<VerificationField>([
  'degree_date',
  'graduation_date',
  'license_date',
]);

const HIGH_FIELDS = new Set<VerificationField>([
  'degree_date',
  'graduation_date',
  'license_date',
  'license_status',
  'specialty',
  'lead_author',
  'certification_organization',
  'university',
  'board_certification',
  'university_accreditation',
]);

export function sameCollectedValue(
  field: VerificationField,
  left: string,
  right: string,
): boolean {
  if (canonical(field, left) === canonical(field, right)) return true;
  if (!DATE_FIELDS.has(field)) return false;
  const leftYear = yearOf(left);
  const rightYear = yearOf(right);
  if (!leftYear || !rightYear || leftYear !== rightYear) return false;
  const leftFull = /\d{4}-\d{2}-\d{2}/.test(left);
  const rightFull = /\d{4}-\d{2}-\d{2}/.test(right);
  return !leftFull || !rightFull;
}

export function severityFor(
  field: VerificationField,
  label: InconsistencyLabel,
): 'low' | 'medium' | 'high' {
  if (field === 'license_status') return 'high';
  if (label === 'conflicting')
    return HIGH_FIELDS.has(field) ? 'high' : 'medium';
  if (label === 'partially_verified') return 'medium';
  if (label === 'not_found' || label === 'unable_to_verify') return 'medium';
  return 'low';
}

export function priorityFor(
  severity: 'low' | 'medium' | 'high',
  label: InconsistencyLabel,
): number {
  const severityRank = severity === 'high' ? 0 : severity === 'medium' ? 1 : 2;
  const labelRank: Record<InconsistencyLabel, number> = {
    conflicting: 0,
    not_found: 1,
    partially_verified: 2,
    not_verified: 3,
    unable_to_verify: 4,
    verified: 5,
  };
  return severityRank * 10 + labelRank[label];
}

const LAPSED = new Set([
  'lapsed',
  'expired',
  'inactive',
  'suspended',
  'revoked',
  'surrendered',
]);

export function isLapsedStatus(value: string): boolean {
  return LAPSED.has(value.trim().toLowerCase());
}

function canonical(field: VerificationField, value: string): string {
  const text = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (field !== 'lead_author') return text;
  if (
    text === 'lead' ||
    text === 'first' ||
    text === 'first author' ||
    text === 'lead author' ||
    text === 'yes' ||
    text === 'true'
  ) {
    return 'lead';
  }
  if (
    text === 'not lead' ||
    text === 'no' ||
    text === 'false' ||
    text === 'co-author' ||
    text === 'coauthor' ||
    text === 'middle' ||
    text === 'contributor' ||
    text === 'contributing' ||
    text === 'last' ||
    text === 'senior'
  ) {
    return 'not lead';
  }
  return text;
}

function yearOf(value: string): string | null {
  const years = value.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  return years.length === 1 ? years[0] : null;
}
