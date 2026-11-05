/**
 * Deterministic checks before a web claim becomes a subject report finding.
 * Keeps identity tiers (strong/possible/…) but decides what may enter a
 * subject section versus identity-disambiguation only.
 */
import {
  quoteNamesOtherPerson,
  quoteNamesSubject,
  type IdentitySubject,
} from './identity-assess';
import { isOwnPage } from './claim-topics';
import type {
  MatchLevel,
  WebClaim,
  WebClaimTopic,
  WebRecord,
  WebSourceKind,
} from './web-research.types';

/** Sections that attribute content to the investigated expert. */
export const SUBJECT_FINDING_SECTIONS = new Set([
  'background',
  'education',
  'university-accreditation',
  'licenses',
  'board-actions',
  'board-certifications',
  'certification-orgs',
  'memberships',
  'publications',
  'grants',
  'patents',
  'awards-military',
  'ime',
  'orders',
  'pleadings',
  'depositions',
  'testimony-inconsistencies',
  'income-bias',
  'lawsuits',
  'criminal',
  'corporate',
  'patient-reviews',
  'office-location',
  'admissibility-challenges',
  'university-rules',
  'websites',
  'directories',
  'social',
  'videos',
  'news',
]);

const ADVERSE_TOPICS = new Set<WebClaimTopic>(['criminal', 'discipline']);

const DIFFERENT_PERSON_CLAIM =
  /\b(?:different (?:individual|person|party|parties|nicole)|pertain(?:s)? to a different|involve(?:s)? different|not (?:the|this) (?:same )?(?:expert|subject|person|individual)|unrelated (?:person|individual)|another (?:person|individual) named)\b/i;

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Subject-section findings require a strong identity match. */
export function matchAllowsSubjectFinding(level: MatchLevel): boolean {
  return level === 'strong';
}

/** Claim text that explicitly disclaims the investigated expert. */
export function claimIdentifiesDifferentPerson(text: string): boolean {
  return DIFFERENT_PERSON_CLAIM.test(text);
}

/** Adverse criminal/discipline claims need a read page, not a search snippet. */
export function isUnreadAdverseClaim(
  claim: WebClaim,
  record: Pick<WebRecord, 'read'>,
): boolean {
  if (!claim.topic || !ADVERSE_TOPICS.has(claim.topic)) return false;
  return record.read !== 'read';
}

/**
 * Multi-person expert/license registry tables: many distinct licensed names
 * and street addresses without a subject-tied office line.
 */
export function isMultiPersonRegistryDump(text: string): boolean {
  const licenseHits = text.match(
    /\b(?:PY|ME|OS|CH|DN|RN|PA|PT)\d{3,6}\b|\blicense(?:\s*#| number)?\s*[:.]?\s*\d{4,}\b/gi,
  );
  const personLines = text.match(
    /\b[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+,?\s+(?:Psy\.?D\.?|Ph\.?D\.?|M\.?D\.?|D\.?O\.?|Ed\.?D\.?)\b/g,
  );
  const addresses = text.match(
    /\b\d{2,6}\s+[A-Z0-9][A-Za-z0-9.]*(?:\s+[A-Z0-9][A-Za-z0-9.]*){0,4}\s+(?:Ave|Avenue|St|Street|Blvd|Rd|Road|Dr|Drive|Way|Pkwy|Ln|Lane|Ct|Hwy|Suite|Ste)\b/gi,
  );
  return (
    (licenseHits?.length ?? 0) >= 3 ||
    (personLines?.length ?? 0) >= 3 ||
    ((addresses?.length ?? 0) >= 4 && (personLines?.length ?? 0) >= 2)
  );
}

/** Office/address claim must sit near a subject name mention. */
export function officeClaimNearSubject(
  claim: WebClaim,
  pageText: string,
  subject: IdentitySubject,
): boolean {
  const hay = `${claim.text} ${claim.quote ?? ''}`;
  if (quoteNamesSubject(hay, subject.name)) return true;
  if (!claim.quote && !claim.text) return false;
  const needle = (claim.quote ?? claim.text).slice(0, 80);
  const index = pageText.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return false;
  // Subject must appear in the lead-in to the address (letterhead / byline),
  // not only later on the same page after other professionals.
  const window = pageText.slice(Math.max(0, index - 140), index + needle.length);
  return quoteNamesSubject(window, subject.name);
}

function normalizeEntityKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(
      /\b(llc|inc|incorporated|pa|pllc|corp|corporation|llp|ltd|pc|phd|ph d)\b/g,
      '',
    )
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * Reject corporate findings when the linked URL clearly names a different
 * entity than the claim (e.g. claim "Nicole Graham, Ph.D., P.A." → slug
 * "acha-merrillwood-i-inc").
 */
export function corporateClaimMatchesSource(input: {
  companyName: string;
  url: string;
  pageText?: string | null;
  quote?: string | null;
}): boolean {
  const wanted = normalizeEntityKey(input.companyName);
  if (wanted.length < 4) return false;
  const tokens = input.companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (t) =>
        t.length >= 4 &&
        !['llc', 'inc', 'incorporated', 'pllc', 'corp', 'ltd', 'phd'].includes(
          t,
        ),
    );
  // Entity-like URL slugs (company pages) that share no token with the claim
  // → mismatch, even when the quote repeats the claimed name.
  try {
    const path = new URL(input.url).pathname.toLowerCase();
    const slugParts = path.split('/').filter(Boolean);
    const slug = slugParts[slugParts.length - 1] ?? '';
    const slugKey = normalizeEntityKey(slug);
    const looksLikeEntitySlug =
      /(?:llc|inc|corp|pllc|ltd|pa-|p-a|company|n\d{8,})/i.test(slug) ||
      (slug.includes('-') && slugKey.length >= 12);
    if (
      looksLikeEntitySlug &&
      tokens.length > 0 &&
      !tokens.some((t) => slugKey.includes(t.replace(/[^a-z0-9]/g, '')))
    ) {
      return false;
    }
  } catch {
    /* ignore */
  }
  // Quote/page text may name the entity; URL-slug mismatch already rejected
  // wrong company pages above.
  const pageHay = `${input.url} ${input.pageText ?? ''} ${input.quote ?? ''}`.toLowerCase();
  const pageKey = normalizeEntityKey(pageHay);
  if (pageKey.includes(wanted)) return true;
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => pageHay.includes(t)).length;
  return matched >= Math.min(2, tokens.length) || matched >= 1 && tokens.length === 1;
}

export interface ClaimGateInput {
  claim: WebClaim;
  record: WebRecord;
  sectionId: string;
  subject?: IdentitySubject | null;
  pageText?: string | null;
}

export type ClaimGateResult =
  | { accept: true }
  | { accept: false; reason: string };

/** Validate a claim before it is filed under a subject report section. */
export function gateSubjectClaim(input: ClaimGateInput): ClaimGateResult {
  const { claim, record, sectionId } = input;
  if (!SUBJECT_FINDING_SECTIONS.has(sectionId)) {
    return { accept: true };
  }
  if (!matchAllowsSubjectFinding(record.match.level)) {
    return {
      accept: false,
      reason: 'Identity match is not strong enough for a subject finding.',
    };
  }
  const claimHay = `${claim.text} ${claim.quote ?? ''}`;
  if (claimIdentifiesDifferentPerson(claimHay)) {
    return {
      accept: false,
      reason: 'Claim text identifies a different person.',
    };
  }
  if (
    input.subject &&
    quoteNamesOtherPerson(claimHay, input.subject.name) &&
    !quoteNamesSubject(claimHay, input.subject.name)
  ) {
    return {
      accept: false,
      reason: 'Claim names a different first name with the same surname.',
    };
  }
  if (isUnreadAdverseClaim(claim, record)) {
    return {
      accept: false,
      reason: 'Adverse claim came from an unread search snippet.',
    };
  }
  if (
    (claim.topic === 'office' || sectionId === 'office-location') &&
    isMultiPersonRegistryDump(
      `${record.title} ${record.summary} ${claim.text} ${claim.quote ?? ''} ${input.pageText ?? ''}`,
    )
  ) {
    return {
      accept: false,
      reason: 'Office text looks like a multi-person registry dump.',
    };
  }
  if (
    (claim.topic === 'office' || sectionId === 'office-location') &&
    input.subject &&
    input.pageText &&
    !officeClaimNearSubject(claim, input.pageText, input.subject)
  ) {
    return {
      accept: false,
      reason: 'Office address is not near a subject name mention.',
    };
  }
  if (
    (claim.topic === 'corporate' || sectionId === 'corporate') &&
    !corporateClaimMatchesSource({
      companyName: claim.text,
      url: record.url,
      pageText: input.pageText,
      quote: claim.quote,
    })
  ) {
    // Corporate claim text is often "X is named…"; try quote / title too.
    const entity =
      (claim.quote && claim.quote.length < 120 ? claim.quote : null) ??
      claim.text;
    if (
      !corporateClaimMatchesSource({
        companyName: entity,
        url: record.url,
        pageText: input.pageText,
        quote: claim.quote,
      })
    ) {
      return {
        accept: false,
        reason: 'Corporate claim entity does not match the linked source.',
      };
    }
  }
  return { accept: true };
}

/** Own-site / practice pages should not reappear under Other People. */
export function isExpertOwnedRecord(
  record: Pick<WebRecord, 'kind' | 'url'>,
  surname: string,
): boolean {
  return isOwnPage(record.kind, record.url, surname);
}

const NON_AMBIGUITY_GENRES =
  /\b(obituar(?:y|ies)|passed away|in loving memory|funeral|sports|basketball|football|soccer|coach|athlete|journalist|newsletter editor|tribute wall)\b/i;

/**
 * Another person belongs in §39 only when confusion with the subject is
 * plausible (similar full name + overlapping profession/place), not merely
 * because a search hit shared a surname.
 */
export function isAmbiguityWorthReporting(input: {
  label: string;
  basis: string[];
  records: Array<Pick<WebRecord, 'title' | 'summary' | 'url' | 'kind' | 'match'>>;
  subjectSpecialty?: string;
}): boolean {
  const hay = [
    input.label,
    ...input.basis,
    ...input.records.flatMap((r) => [r.title, r.summary, r.url]),
  ]
    .join(' ')
    .toLowerCase();

  // Different first name with no professional overlap → dump.
  const differentFirst = input.basis.some((line) =>
    /different first name/i.test(line),
  );
  if (differentFirst) {
    const specialty = (input.subjectSpecialty ?? '').toLowerCase();
    const stems = specialty
      .split(/[^a-z]+/)
      .filter((w) => w.length > 4);
    const overlap =
      stems.length > 0 && stems.some((s) => hay.includes(s));
    if (!overlap) return false;
  }

  // Obituaries / sports / journalist pages without specialty overlap.
  if (NON_AMBIGUITY_GENRES.test(hay)) {
    const specialty = (input.subjectSpecialty ?? '').toLowerCase();
    const stems = specialty
      .split(/[^a-z]+/)
      .filter((w) => w.length > 4);
    if (!stems.some((s) => hay.includes(s))) return false;
  }

  // Pure "unconfirmed / nothing ties them" buckets are omitted from §39.
  if (/unconfirmed pages naming/i.test(input.label)) {
    return false;
  }
  // Weak leftovers with no "Another person" label are not ambiguity reports.
  if (
    input.records.every((r) => r.match.level === 'weak') &&
    !/^Another person:/i.test(input.label)
  ) {
    return false;
  }

  // Possible-match groups are useful when they are about the same full name.
  if (/possible match pages/i.test(input.label)) {
    return input.records.some(
      (r) =>
        r.match.level === 'possible' &&
        !isExpertOwnedRecord(r, surnameFromLabel(input.label)),
    );
  }

  return true;
}

function surnameFromLabel(label: string): string {
  const parts = label.replace(/^Another person:\s*/i, '').split(/[,\s]+/);
  return (parts[parts.length - 1] ?? '').replace(/[^a-z]/gi, '').toLowerCase();
}

export function claimFingerprint(statement: string, quote: string | null): string {
  return `${statement} ${quote ?? ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function normalizeFindingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Prefer expert_website / profile kinds for own-domain page caps. */
export function isPracticeSiteKind(kind: WebSourceKind): boolean {
  return (
    kind === 'expert_website' ||
    kind === 'advertising' ||
    kind === 'ime' ||
    kind === 'profile'
  );
}
