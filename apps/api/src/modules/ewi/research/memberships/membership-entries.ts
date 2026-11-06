import type { CvCheck, CvClaim, CvExtraction } from '../../cv/cv.types';
import type { MembershipEntry, MembershipType } from './membership.types';

const YEAR = /\b((?:19|20)\d{2})\b/g;

/** Lines that look like employment, education, training, or board cert — not membership. */
const NOT_MEMBERSHIP =
  /\b(employed|employee|faculty|professor|instructor|appointment|hired|staff\s+at|university\s+of|college\s+of|ph\.?\s*d\.?|psy\.?\s*d\.?|bachelor|master(?:'?s)?|internship|residency|practicum|board[\s-]?certif|diplomate|abpp\b|license[d]?|graduated|degree)\b/i;

const MEMBERSHIP_CUE =
  /\b(member|fellow|membership|affiliate|society|academy|association|committee)\b/i;

const FELLOW = /\bfellow(?:ship)?\b/i;
const COMMITTEE = /\bcommittee\b/i;
const AFFILIATE = /\baffiliate\b/i;

const ORG_AFTER_OF =
  /\b(?:member|fellow|membership|affiliate)\s+(?:of|in|at)\s+(?:the\s+)?(.+?)(?:\s*[,;|]|\s+-\s+|\s+\(|$)/i;

const ORG_PREFIXED =
  /^(?:member|fellow|membership|affiliate)(?:\s+(?:of|in|at))?\s+(?:the\s+)?(.+)$/i;

function yearsIn(text: string): number[] {
  const found: number[] = [];
  for (const match of text.matchAll(YEAR)) {
    const year = Number(match[1]);
    if (year >= 1950 && year <= new Date().getFullYear() + 1) {
      found.push(year);
    }
  }
  return found;
}

function classifyType(text: string): MembershipType {
  if (COMMITTEE.test(text) && !FELLOW.test(text)) return 'committee';
  if (FELLOW.test(text) && !/\bfellowship\b/i.test(text)) return 'fellow';
  // Training fellowships are not membership fellows.
  if (/\bfellowship\b/i.test(text)) return 'unknown';
  if (AFFILIATE.test(text)) return 'affiliate';
  if (/\bmember\b/i.test(text)) return 'member';
  return 'unknown';
}

function stripRolePrefix(raw: string): string {
  return raw
    .replace(
      /^(?:member|fellow|membership|affiliate|active\s+member|full\s+member)\s+(?:of|in|at)\s+(?:the\s+)?/i,
      '',
    )
    .replace(/^(?:the\s+)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickOrganization(
  detailsName: string | undefined,
  statement: string,
): string | null {
  const fromDetails = detailsName?.replace(/\s+/g, ' ').trim();
  if (fromDetails && fromDetails.length >= 3) {
    const cleaned = stripRolePrefix(fromDetails);
    if (cleaned.length >= 3) return cleaned.slice(0, 160);
  }
  const ofMatch = statement.match(ORG_AFTER_OF);
  if (ofMatch?.[1]) {
    return stripRolePrefix(ofMatch[1]).slice(0, 160) || null;
  }
  const prefixed = statement.match(ORG_PREFIXED);
  if (prefixed?.[1]) {
    return stripRolePrefix(prefixed[1]).slice(0, 160) || null;
  }
  // "AACN — Member" / "National Academy of Neuropsychology (Member)"
  const paren = statement.match(
    /^(.{6,120}?)\s*[(–—-]\s*(?:member|fellow|affiliate)/i,
  );
  if (paren?.[1]) return paren[1].replace(/\s+/g, ' ').trim().slice(0, 160);
  return null;
}

function pickStatus(text: string): string | null {
  const match = text.match(
    /\b(active|inactive|current|former|past|emeritus|lifetime)\b/i,
  );
  return match?.[1] ?? null;
}

function looksLikeNonMembership(claim: CvClaim): boolean {
  const hay = `${claim.statement} ${claim.quote} ${claim.details.name ?? ''}`;
  if (!MEMBERSHIP_CUE.test(hay) && !claim.details.name) return true;
  // Board certification / diplomate dumps.
  if (
    /\b(board[\s-]?certif|diplomate)\b/i.test(hay) &&
    !/\b(member|fellow of)\b/i.test(hay)
  ) {
    return true;
  }
  // Education / employment without membership cue as the primary framing.
  if (
    NOT_MEMBERSHIP.test(hay) &&
    !/\b(member|fellow of|membership)\b/i.test(hay)
  ) {
    return true;
  }
  // Training fellowship at a university.
  if (
    /\bfellowship\b/i.test(hay) &&
    /\b(university|college|hospital|medical center|internship|residency)\b/i.test(
      hay,
    )
  ) {
    return true;
  }
  return false;
}

function entryKey(entry: Omit<MembershipEntry, 'id'>): string {
  return [
    (entry.organization ?? '').toLowerCase(),
    entry.membershipType,
    entry.startYear ?? entry.endYear ?? '',
  ].join('|');
}

/** Build structured membership rows from CV claims. Missing fields stay null. */
export function membershipEntriesFromClaims(
  claims: CvClaim[],
  options: { cvSourceUrl?: string | null } = {},
): MembershipEntry[] {
  const byKey = new Map<string, MembershipEntry>();
  let index = 0;
  for (const claim of claims) {
    if (claim.category !== 'membership') continue;
    const statement = claim.statement.replace(/\s+/g, ' ').trim();
    if (statement.length < 6) continue;
    if (looksLikeNonMembership(claim)) continue;

    const organization = pickOrganization(claim.details.name, statement);
    const membershipType = classifyType(
      `${claim.details.name ?? ''} ${statement}`,
    );
    // Training fellowships already filtered; leftover "unknown" with no org skip.
    if (!organization && membershipType === 'unknown') continue;

    const years = yearsIn(
      `${claim.details.year ?? ''} ${statement} ${claim.quote}`,
    );
    const startYear = years.length >= 2 ? years[0] : null;
    const endYear =
      years.length >= 2
        ? years[years.length - 1]
        : years.length === 1
          ? years[0]
          : null;
    const draft: Omit<MembershipEntry, 'id'> = {
      organization,
      membershipType:
        membershipType === 'unknown' && organization
          ? 'member'
          : membershipType,
      statusText: pickStatus(statement),
      startYear,
      endYear,
      designation:
        membershipType === 'fellow'
          ? 'Fellow'
          : membershipType === 'member'
            ? 'Member'
            : null,
      statement: statement.slice(0, 400),
      quote: (claim.quote || statement).slice(0, 280),
      page: claim.page || null,
      cvSourceUrl: options.cvSourceUrl ?? null,
      claimId: claim.id,
    };
    const key = entryKey(draft);
    if (byKey.has(key)) continue;
    index += 1;
    byKey.set(key, { id: `mem-${index}`, ...draft });
  }
  return [...byKey.values()];
}

export function membershipEntriesFromExtraction(
  extraction: CvExtraction | null | undefined,
): MembershipEntry[] {
  if (!extraction) return [];
  return membershipEntriesFromClaims(extraction.claims, {
    cvSourceUrl: extraction.document.id || null,
  });
}

export function membershipEntriesFromCvCheck(
  check: CvCheck | null | undefined,
): MembershipEntry[] {
  if (!check) return [];
  return membershipEntriesFromClaims(check.claims, {
    cvSourceUrl: check.document.id || null,
  });
}
