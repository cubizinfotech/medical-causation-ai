import type { ExpertResearchQuery } from '../expert-research.types';
import { citiesMatch, parseCityState, stateName } from './location';
import type { OrcidRecord, OrcidSearchHit } from './orcid.client';
import { parseOrcidId } from './orcid.client';
import {
  namesCompatible,
  parsePersonName,
  type PersonName,
} from './person-name';
import { specialtyOverlaps } from './specialty-match';

export type OrcidMatchKind = 'confirmed' | 'candidate' | 'rejected';

export interface OrcidMatch {
  kind: OrcidMatchKind;
  orcid: string;
  displayName: string;
  reasons: string[];
}

/**
 * A shared family name is not enough. Confirmation needs a supplied ORCID iD,
 * an affiliation that agrees with place or intake note, a specialty/keyword
 * overlap, or a publication identifier the attorney already named.
 */
export function scoreOrcidCandidate(
  query: ExpertResearchQuery,
  expert: PersonName,
  hit: OrcidSearchHit,
  record: OrcidRecord | null,
): OrcidMatch {
  const display =
    record?.creditName ||
    hit.creditName ||
    [hit.givenNames, hit.familyNames].filter(Boolean).join(' ') ||
    hit.orcid;
  const names = candidateNames(hit, record);
  if (!names.some((name) => namesCompatible(expert, name))) {
    return {
      kind: 'rejected',
      orcid: hit.orcid,
      displayName: display,
      reasons: ['name does not match'],
    };
  }
  const reasons: string[] = ['name'];
  const supplied = parseOrcidId(query.context);
  if (supplied && supplied === hit.orcid) {
    reasons.push('supplied ORCID iD');
    return {
      kind: 'confirmed',
      orcid: hit.orcid,
      displayName: display,
      reasons,
    };
  }
  const institutions = [
    ...hit.institutions,
    ...(record?.employments ?? []),
    ...(record?.educations ?? []),
  ];
  const place = affiliationPlace(institutions, query);
  if (place) reasons.push(place);
  const subject = subjectOverlap(query, record, institutions);
  if (subject) reasons.push(subject);
  const identifiedWork = workInContext(query, record);
  if (identifiedWork) reasons.push(identifiedWork);

  return {
    kind: reasons.length > 1 ? 'confirmed' : 'candidate',
    orcid: hit.orcid,
    displayName: display,
    reasons,
  };
}

function candidateNames(
  hit: OrcidSearchHit,
  record: OrcidRecord | null,
): PersonName[] {
  const given = record?.givenNames || hit.givenNames;
  const family = record?.familyNames || hit.familyNames;
  const labels = [
    `${given} ${family}`.trim(),
    record?.creditName,
    hit.creditName,
    ...(record?.otherNames ?? []),
    ...hit.otherNames,
  ].filter((label): label is string => Boolean(label));
  return labels
    .map((label) => parsePersonName(label))
    .filter((name): name is PersonName => Boolean(name));
}

function affiliationPlace(
  institutions: string[],
  query: ExpertResearchQuery,
): string | null {
  const { city, state } = parseCityState(query.city || '');
  const hay = institutions.join(' | ');
  if (!hay) return null;
  if (city && (citiesMatch(hay, query.city) || containsLoose(hay, city))) {
    return `affiliation place (${city})`;
  }
  const fullState = stateName(state);
  if (fullState && containsLoose(hay, fullState)) {
    return `affiliation state (${fullState})`;
  }
  const note = query.context?.trim() ?? '';
  if (note) {
    for (const institution of institutions) {
      if (institution.length >= 4 && containsLoose(note, institution)) {
        return `affiliation named in intake (${institution})`;
      }
    }
  }
  return null;
}

function subjectOverlap(
  query: ExpertResearchQuery,
  record: OrcidRecord | null,
  institutions: string[],
): string | null {
  const described = [
    ...(record?.keywords ?? []),
    ...(record?.works ?? []).map((work) => work.title).slice(0, 8),
    ...institutions,
  ].join(' ');
  if (!described.trim()) return null;
  if (specialtyOverlaps(query.specialty, described)) {
    return 'research subject / specialty';
  }
  return null;
}

function workInContext(
  query: ExpertResearchQuery,
  record: OrcidRecord | null,
): string | null {
  const note = query.context ?? '';
  if (!note || !record) return null;
  for (const work of record.works) {
    if (work.doi && note.toLowerCase().includes(work.doi.toLowerCase())) {
      return `shared DOI ${work.doi}`;
    }
    if (work.pmid && note.includes(work.pmid)) {
      return `shared PMID ${work.pmid}`;
    }
  }
  return null;
}

function containsLoose(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}
