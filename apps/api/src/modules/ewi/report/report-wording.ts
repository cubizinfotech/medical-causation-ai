import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { EwiAssessment } from '../investigation/analysis/ewi-analysis.types';

/**
 * How the report states verification. Every collected item is shown as its
 * source states it, with the source cited. Only an outcome worth acting on
 * (verified, conflicting, restricted, unavailable) is labelled; "not
 * verified" (one source, not cross-checked) is the default and is not
 * repeated on every line.
 */

/** Wording that says a statement was not verified. */
const UNVERIFIED =
  /could not (?:be )?verif|not (?:been |fully |independently )?(?:verified|confirmed)|unverified/i;

/** The analysis's opening for a conflict, e.g. "Could not verify a single account." */
const SINGLE_ACCOUNT = /\bCould not verify a single account\.\s*/gi;

const FINDING_LABEL: Partial<Record<EwiAssessment, string>> = {
  verified: 'Verified',
  partially_verified: 'Partially Verified',
  conflicting: 'Sources disagree',
  restricted: 'Unable to Access',
  unavailable: 'Unable to Access',
  not_found: 'Not Found',
  not_verified: 'Not Independently Verified',
};

/** The label of an overall finding, or null when there is nothing to flag. */
export function findingLabel(status: EwiAssessment): string | null {
  return FINDING_LABEL[status] ?? null;
}

/**
 * An overall finding as its statement. The analysis writes it as
 * 'Could not verify "X". The npi_registry statement is not verified.' (or
 * 'The source npi_registry supports "X".'); the report shows X. Other
 * wording (from the AI) keeps its sentences except those saying the item
 * was not verified.
 */
export function findingStatement(text: string): string {
  const quoted = /"([^"]+)"|“([^”]+)”/.exec(text);
  if (
    quoted &&
    (UNVERIFIED.test(text) ||
      /\bsupports\b|partially verified|conflict/i.test(text))
  ) {
    return (quoted[1] ?? quoted[2]).trim();
  }
  return withoutUnverifiedSentences(text) || text;
}

/** The sentences of `text` that do not say something was not verified. */
export function withoutUnverifiedSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() && !UNVERIFIED.test(sentence))
    .join(' ');
}

/** A conflict or question without the analysis's "could not verify" opening. */
export function withoutSingleAccount(text: string): string {
  return text.replace(SINGLE_ACCOUNT, '').trim();
}

/**
 * A question's basis as source references. A caution that the item is not
 * verified is dropped; others (an unavailable source) stay.
 */
export function questionBasis(basis: string): string {
  const [refs, ...notes] = basis.split(' — ');
  return [refs, ...notes.filter((note) => !UNVERIFIED.test(note))]
    .filter((part) => part.trim())
    .join(' — ');
}

/**
 * Evidence-standard label for a collected item. An expert's own claim is
 * never treated as independent verification.
 */
export function evidenceStatusLine(item: ExpertEvidenceItem): string {
  const ownSite =
    item.sourceId === 'expert_website' ||
    item.sourceId === 'cv_profile' ||
    item.sourceId === 'other_public_websites' ||
    item.category === 'cv' ||
    item.category === 'website';
  // Directory / university / court existence is not a Verified credential or policy.
  const existenceOnly =
    item.category === 'directory' ||
    item.category === 'university' ||
    item.category === 'university_rules' ||
    item.category === 'court' ||
    item.category === 'litigation' ||
    item.sourceId === 'courtlistener' ||
    item.sourceId === 'university' ||
    item.sourceId === 'university_rules' ||
    item.sourceId === 'other_expert_directories';
  const catalogPub =
    item.category === 'publication' &&
    ['pubmed', 'openalex', 'crossref', 'orcid'].includes(item.sourceId);

  let status: string;
  if (ownSite) {
    status = 'Self-Reported';
  } else if (item.access === 'restricted') {
    status = 'Unable to Access';
  } else if (item.informationStatus === 'unavailable') {
    status = 'Not Found';
  } else if (item.informationStatus === 'conflicting') {
    status = 'Sources disagree';
  } else if (existenceOnly) {
    status = 'Not Independently Verified';
  } else if (item.informationStatus === 'verified') {
    status = catalogPub
      ? 'Verified (catalog record; not a CV comparison)'
      : 'Verified';
  } else if (catalogPub) {
    status = 'Verified (catalog record; not a CV comparison)';
  } else if (item.sourceId === 'npi_registry') {
    status = 'Self-Reported (NPI Registry record retrieved)';
  } else {
    status = 'Not Independently Verified';
  }
  return `Status: ${status}. Source: ${item.sourceId}.`;
}

const CATALOG_SOURCES = new Set([
  'pubmed',
  'openalex',
  'crossref',
  'orcid',
  'npi_registry',
  'open_payments',
]);

function retrievalStatusOf(item: ExpertEvidenceItem): string | undefined {
  const raw = item.raw ?? {};
  if (typeof raw.retrievalStatus === 'string' && raw.retrievalStatus.trim()) {
    return raw.retrievalStatus.trim().toLowerCase();
  }
  const web = raw.web as { read?: string } | undefined;
  return web?.read;
}

/**
 * How much of the source was actually opened. A search hit or docket URL is
 * not treated as a read page or PDF.
 */
export function sourceAccessLabel(item: ExpertEvidenceItem): string {
  if (item.access === 'restricted') {
    return 'not read (restricted)';
  }
  const retrieval = retrievalStatusOf(item);
  if (retrieval === 'full_text' || retrieval === 'read') {
    return 'page content read';
  }
  if (retrieval === 'snippet_only') {
    return 'search result only';
  }
  if (retrieval === 'metadata_only') {
    return 'docket metadata only';
  }
  if (
    retrieval === 'restricted' ||
    retrieval === 'failed' ||
    retrieval === 'not_read'
  ) {
    return 'not read (login or bot protection)';
  }
  if (item.informationStatus === 'unavailable') {
    return 'not retrieved';
  }
  if (CATALOG_SOURCES.has(item.sourceId)) {
    return 'catalog record retrieved';
  }
  return 'page retrieved';
}

/** The status part of a source index entry. Access/read, not “verified.” */
export function sourceIndexStatus(item: ExpertEvidenceItem): string {
  return `; access: ${sourceAccessLabel(item)}`;
}
