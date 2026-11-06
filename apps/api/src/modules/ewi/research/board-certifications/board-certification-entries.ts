import type { CvCheck, CvClaim, CvExtraction } from '../../cv/cv.types';
import type { BoardCertificationEntry } from './board-certification.types';
import { resolveCertifyingBoard } from './certification-registry';

/** Membership / academy affiliation — not board certification. */
const MEMBERSHIP_ONLY =
  /\b(member(?:ship)?|fellow of|affiliate)\b/i;

const NOT_BOARD_CERT =
  /\b(license[d]?|licensure|ph\.?\s*d\.?|psy\.?\s*d\.?|m\.?\s*d\.?|bachelor|master(?:'?s)?|degree|graduated|university of|college of|internship|residency|practicum|cme\b|continuing education|certificate of (?:attendance|completion)|course completion|employed|faculty appointment)\b/i;

const BOARD_CUE =
  /\b(board[\s-]?certif|diplomate|certified by the american board|abpp\b|abpn\b|abim\b|abms\b|abos\b|abp\b)\b/i;

const YEAR = /\b((?:19|20)\d{2})\b/;

function looksLikeNonBoardCert(claim: CvClaim): boolean {
  const hay = `${claim.statement} ${claim.quote} ${claim.details.board ?? ''} ${claim.details.name ?? ''}`;
  // Explicit membership without diplomate/board-certified framing.
  if (
    MEMBERSHIP_ONLY.test(hay) &&
    !/\b(board[\s-]?certif|diplomate)\b/i.test(hay)
  ) {
    return true;
  }
  // Degree / license / training without board cue.
  if (NOT_BOARD_CERT.test(hay) && !BOARD_CUE.test(hay)) {
    return true;
  }
  // Training fellowship.
  if (
    /\bfellowship\b/i.test(hay) &&
    !/\b(board[\s-]?certif|diplomate)\b/i.test(hay)
  ) {
    return true;
  }
  return false;
}

function pickBoardName(claim: CvClaim): string | null {
  const fromDetails = claim.details.board?.replace(/\s+/g, ' ').trim();
  if (fromDetails && fromDetails.length >= 3) return fromDetails.slice(0, 160);
  const statement = claim.statement.replace(/\s+/g, ' ').trim();
  const by = statement.match(
    /\b(?:board[\s-]?certified(?:\s+in\s+[^,;]+)?\s+by|diplomate\s+of|certified\s+by)\s+(?:the\s+)?(.+?)(?:\s*[,;.]|$)/i,
  );
  if (by?.[1]) return by[1].replace(/\s+/g, ' ').trim().slice(0, 160);
  const acronym = statement.match(/\b(ABPP(?:[-\s]?CN)?|ABPN|ABIM|ABMS|ABOS|ABP)\b/i);
  if (acronym?.[1]) return acronym[1].toUpperCase().replace(/\s+/g, '');
  return null;
}

function pickCredential(claim: CvClaim, boardName: string | null): string | null {
  if (claim.details.specialty?.trim()) {
    return claim.details.specialty.trim().slice(0, 120);
  }
  const inMatch = claim.statement.match(
    /\bboard[\s-]?certified\s+in\s+([^,;.]+)/i,
  );
  if (inMatch?.[1]) return inMatch[1].replace(/\s+/g, ' ').trim().slice(0, 120);
  if (boardName && /abpp/i.test(boardName)) {
    return 'Board certification (ABPP)';
  }
  return claim.statement.replace(/\s+/g, ' ').trim().slice(0, 120) || null;
}

function pickYear(claim: CvClaim): string | null {
  if (claim.details.year?.trim()) return claim.details.year.trim();
  const match = `${claim.statement} ${claim.quote}`.match(YEAR);
  return match?.[1] ?? null;
}

function pickStatus(claim: CvClaim): string | null {
  if (claim.details.status?.trim()) return claim.details.status.trim();
  const match = `${claim.statement} ${claim.quote}`.match(
    /\b(active|inactive|current|expired|emeritus)\b/i,
  );
  return match?.[1] ?? null;
}

function confidenceFor(
  claim: CvClaim,
  boardId: string | null,
): BoardCertificationEntry['extractionConfidence'] {
  if (boardId && BOARD_CUE.test(claim.statement)) return 'high';
  if (BOARD_CUE.test(claim.statement) || BOARD_CUE.test(claim.quote)) {
    return 'medium';
  }
  return 'low';
}

function entryKey(entry: Omit<BoardCertificationEntry, 'id'>): string {
  return [
    (entry.boardId ?? entry.boardName ?? '').toLowerCase(),
    (entry.credentialName ?? '').toLowerCase(),
    entry.certificationDate ?? '',
  ].join('|');
}

/**
 * Build board-certification entries from extracted CV claims.
 * Rejects memberships, degrees, licenses, and training fellowships.
 */
export function boardCertificationEntriesFromClaims(
  claims: CvClaim[],
  options: { cvSourceUrl?: string | null } = {},
): BoardCertificationEntry[] {
  const out: BoardCertificationEntry[] = [];
  const seen = new Set<string>();
  let index = 0;

  for (const claim of claims) {
    if (claim.category !== 'board_certification') continue;
    if (looksLikeNonBoardCert(claim)) continue;

    const boardName = pickBoardName(claim);
    const board = resolveCertifyingBoard(
      [boardName, claim.details.board, claim.statement, claim.quote]
        .filter(Boolean)
        .join(' '),
    );
    const entry: Omit<BoardCertificationEntry, 'id'> = {
      credentialName: pickCredential(claim, boardName),
      boardName: board?.canonicalName ?? boardName,
      boardId: board?.id ?? null,
      specialty: claim.details.specialty?.trim() || null,
      certificationDate: pickYear(claim),
      expirationOrStatus: pickStatus(claim),
      certificationNumber: null,
      statement: claim.statement.replace(/\s+/g, ' ').trim(),
      quote: claim.quote.replace(/\s+/g, ' ').trim(),
      page: claim.page ?? null,
      cvSourceUrl: options.cvSourceUrl ?? null,
      claimId: claim.id,
      extractionConfidence: confidenceFor(claim, board?.id ?? null),
    };
    const key = entryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...entry, id: `bc-${++index}` });
  }

  return out;
}

export function boardCertificationEntriesFromExtraction(
  extraction: CvExtraction,
): BoardCertificationEntry[] {
  return boardCertificationEntriesFromClaims(extraction.claims, {
    cvSourceUrl: extraction.document?.name
      ? `cv://${extraction.document.id}`
      : null,
  });
}

export function boardCertificationEntriesFromCvCheck(
  cvCheck: CvCheck,
): BoardCertificationEntry[] {
  return boardCertificationEntriesFromClaims(cvCheck.claims, {
    cvSourceUrl: cvCheck.document?.name
      ? `cv://${cvCheck.document.id}`
      : null,
  });
}
