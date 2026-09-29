import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  defaultSubject,
  isVerificationField,
  type VerificationField,
} from './verification-labels';

export interface ExtractedClaim {
  field: VerificationField;
  subject: string;
  value: string;
  role: 'claim' | 'record';
  lookup: 'stated' | 'not_found';
  cvDate: string | null;
  cvSource: string | null;
  sourceId: string;
  sourceName: string;
  title: string;
  url?: string;
  retrievedAt?: string;
  informationStatus: string;
}

const CLAIM_SOURCES = new Set(['cv_profile', 'expert_website', 'orcid']);

/**
 * Reads comparable statements from collected raw fields.
 * Titles and summaries are not parsed into credentials.
 */
export function extractClaims(items: ExpertEvidenceItem[]): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  for (const item of items) {
    if (item.identityMatch === 'uncertain') continue;
    if (!item.raw) continue;
    claims.push(...claimsFromItem(item));
  }
  return claims;
}

function claimsFromItem(item: ExpertEvidenceItem): ExtractedClaim[] {
  const raw = item.raw ?? {};
  const found: ExtractedClaim[] = [];
  const cvDate = readString(raw.cvDate) ?? readString(raw.documentDate);
  const cvSource = readString(raw.cvSource);

  const listed = raw.claims;
  if (Array.isArray(listed)) {
    for (const entry of listed) {
      const claim = claimFromEntry(item, entry, cvDate, cvSource);
      if (claim) found.push(claim);
    }
  }

  pushScalar(
    found,
    item,
    raw,
    'graduationYear',
    'graduation_date',
    cvDate,
    cvSource,
  );
  pushScalar(
    found,
    item,
    raw,
    'graduationDate',
    'graduation_date',
    cvDate,
    cvSource,
  );
  pushScalar(found, item, raw, 'degreeYear', 'degree_date', cvDate, cvSource);
  pushScalar(found, item, raw, 'degreeDate', 'degree_date', cvDate, cvSource);
  pushScalar(found, item, raw, 'university', 'university', cvDate, cvSource);
  pushScalar(found, item, raw, 'degree', 'education', cvDate, cvSource);
  pushScalar(
    found,
    item,
    raw,
    'accreditation',
    'university_accreditation',
    cvDate,
    cvSource,
  );
  pushScalar(found, item, raw, 'specialty', 'specialty', cvDate, cvSource);
  pushScalar(
    found,
    item,
    raw,
    'board',
    'board_certification',
    cvDate,
    cvSource,
  );
  pushScalar(
    found,
    item,
    raw,
    'certificationOrganization',
    'certification_organization',
    cvDate,
    cvSource,
  );
  pushScalar(found, item, raw, 'membership', 'membership', cvDate, cvSource);
  pushScalar(found, item, raw, 'grant', 'grant', cvDate, cvSource);
  pushScalar(found, item, raw, 'patent', 'patent', cvDate, cvSource);
  pushScalar(found, item, raw, 'award', 'award', cvDate, cvSource);
  pushScalar(found, item, raw, 'medal', 'military', cvDate, cvSource);
  pushScalar(found, item, raw, 'military', 'military', cvDate, cvSource);
  pushScalar(found, item, raw, 'employer', 'employment', cvDate, cvSource);
  pushScalar(
    found,
    item,
    raw,
    'universityAffiliation',
    'university_affiliation',
    cvDate,
    cvSource,
  );
  pushScalar(
    found,
    item,
    raw,
    'corporateAffiliation',
    'corporate_affiliation',
    cvDate,
    cvSource,
  );

  const licenseDate = readString(raw.licenseDate);
  if (licenseDate) {
    found.push(
      build(
        item,
        'license_date',
        readString(raw.state) ?? 'license',
        licenseDate,
        roleFor(item),
        'stated',
        cvDate,
        cvSource,
      ),
    );
  }

  const licenseStatus = readString(raw.licenseStatus) ?? readString(raw.status);
  if (
    licenseStatus &&
    (raw.licenseStatus != null || item.category === 'license')
  ) {
    found.push(
      build(
        item,
        'license_status',
        readString(raw.state) ?? 'license',
        licenseStatus,
        roleFor(item),
        'stated',
        cvDate,
        cvSource,
      ),
    );
  }

  const state = readString(raw.state);
  if (state && item.category === 'license') {
    found.push(
      build(
        item,
        'license',
        state,
        state,
        roleFor(item),
        'stated',
        cvDate,
        cvSource,
      ),
    );
  }

  const claimedStates = raw.claimedStates;
  if (Array.isArray(claimedStates)) {
    for (const value of claimedStates) {
      if (typeof value !== 'string' || !value.trim()) continue;
      found.push(
        build(
          item,
          'license',
          value.trim(),
          value.trim(),
          'claim',
          'stated',
          cvDate,
          cvSource,
        ),
      );
    }
  }

  const claimedBoard = readString(raw.claimedBoard);
  if (claimedBoard) {
    found.push(
      build(
        item,
        'board_certification',
        'board_certification',
        claimedBoard,
        'claim',
        'stated',
        cvDate,
        cvSource,
      ),
    );
  }

  pushAuthorship(found, item, raw, cvDate, cvSource);
  return dedupe(found);
}

function claimFromEntry(
  item: ExpertEvidenceItem,
  entry: unknown,
  cvDate: string | null,
  cvSource: string | null,
): ExtractedClaim | null {
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  const fieldName = readString(row.field);
  const value = readString(row.value);
  if (!fieldName || !value || !isVerificationField(fieldName)) return null;
  const subject = readString(row.subject) ?? defaultSubject(fieldName, value);
  const lookup = row.found === false ? 'not_found' : 'stated';
  const role =
    row.role === 'record' || row.role === 'claim' ? row.role : roleFor(item);
  return build(
    item,
    fieldName,
    subject,
    value,
    role,
    lookup,
    readString(row.cvDate) ?? cvDate,
    readString(row.cvSource) ?? cvSource,
  );
}

function pushScalar(
  found: ExtractedClaim[],
  item: ExpertEvidenceItem,
  raw: Record<string, unknown>,
  key: string,
  field: VerificationField,
  cvDate: string | null,
  cvSource: string | null,
): void {
  const value = readString(raw[key]);
  if (!value) return;
  found.push(
    build(
      item,
      field,
      defaultSubject(field, value),
      value,
      roleFor(item),
      'stated',
      cvDate,
      cvSource,
    ),
  );
}

function pushAuthorship(
  found: ExtractedClaim[],
  item: ExpertEvidenceItem,
  raw: Record<string, unknown>,
  cvDate: string | null,
  cvSource: string | null,
): void {
  const subject =
    readString(raw.publication) ??
    readString(raw.publicationTitle) ??
    item.title;
  const position = readString(raw.authorPosition);
  if (position) {
    found.push(
      build(
        item,
        'authorship',
        subject,
        position,
        roleFor(item),
        'stated',
        cvDate,
        cvSource,
      ),
    );
    found.push(
      build(
        item,
        'lead_author',
        subject,
        position,
        roleFor(item),
        'stated',
        cvDate,
        cvSource,
      ),
    );
  }

  if (
    typeof raw.leadAuthor === 'boolean' ||
    typeof raw.firstAuthor === 'boolean'
  ) {
    const lead = raw.leadAuthor === true || raw.firstAuthor === true;
    found.push(
      build(
        item,
        'lead_author',
        subject,
        lead ? 'lead' : 'not lead',
        roleFor(item),
        'stated',
        cvDate,
        cvSource,
      ),
    );
  } else {
    const lead = readString(raw.leadAuthor) ?? readString(raw.firstAuthor);
    if (lead) {
      found.push(
        build(
          item,
          'lead_author',
          subject,
          lead,
          roleFor(item),
          'stated',
          cvDate,
          cvSource,
        ),
      );
    }
  }
}

function roleFor(item: ExpertEvidenceItem): 'claim' | 'record' {
  if (item.category === 'cv' || CLAIM_SOURCES.has(item.sourceId))
    return 'claim';
  if (item.raw?.cvDate || item.raw?.documentDate) return 'claim';
  return 'record';
}

function build(
  item: ExpertEvidenceItem,
  field: VerificationField,
  subject: string,
  value: string,
  role: 'claim' | 'record',
  lookup: 'stated' | 'not_found',
  cvDate: string | null,
  cvSource: string | null,
): ExtractedClaim {
  const sourceName = cvSource ?? item.source?.name ?? item.title;
  return {
    field,
    subject: subject.trim() || field,
    value: value.trim(),
    role,
    lookup,
    cvDate,
    cvSource,
    sourceId: item.sourceId,
    sourceName,
    title: item.title,
    url: item.url,
    retrievedAt: item.retrievedAt,
    informationStatus: item.informationStatus ?? 'unverified',
  };
}

function dedupe(claims: ExtractedClaim[]): ExtractedClaim[] {
  const seen = new Set<string>();
  const unique: ExtractedClaim[] = [];
  for (const claim of claims) {
    const key = [
      claim.field,
      claim.subject.toLowerCase(),
      claim.value.toLowerCase(),
      claim.role,
      claim.lookup,
      claim.sourceId,
      claim.cvDate ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(claim);
  }
  return unique;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
