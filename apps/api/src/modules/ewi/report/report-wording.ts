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
  partially_verified: 'Partly verified',
  conflicting: 'Sources disagree',
  restricted: 'Restricted source; content not stored',
  unavailable: 'Source unavailable',
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

/** "Status: Verified. Source: npi_registry." or, when not verified, "Source: npi_registry." */
export function evidenceStatusLine(item: ExpertEvidenceItem): string {
  const status =
    item.access === 'restricted'
      ? 'Restricted'
      : item.informationStatus === 'conflicting'
        ? 'Conflicting'
        : item.informationStatus === 'verified'
          ? 'Verified'
          : item.informationStatus === 'unavailable'
            ? 'Unavailable'
            : null;
  return status
    ? `Status: ${status}. Source: ${item.sourceId}.`
    : `Source: ${item.sourceId}.`;
}

/** The status part of a source index entry; empty when not verified. */
export function sourceIndexStatus(item: ExpertEvidenceItem): string {
  const status = item.informationStatus;
  return status && !UNVERIFIED.test(status) ? `; status: ${status}` : '';
}
