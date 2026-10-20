/**
 * Compares credential claims with the body that issues them.
 *
 * A claim made on the person's own site, in a court document or in a directory
 * is reported as a claim. It becomes "confirmed" only when a page from the
 * issuing body or an official registry was read and names the person under
 * that topic. When no such page was found the report says which: the body's
 * site was searched and nothing matched, or it was never searched.
 */
import {
  officialSourceFor,
  organizationsIn,
  TOPIC_LABEL,
} from './claim-topics';
import type {
  WebClaim,
  WebClaimTopic,
  WebRecord,
  WebVerification,
} from './web-research.types';

const VERIFIED_TOPICS: readonly WebClaimTopic[] = [
  'board_certification',
  'membership',
  'license',
  'publication',
  'grant',
  'patent',
];

function tied(record: WebRecord): boolean {
  return record.match.level === 'strong' || record.match.level === 'possible';
}

interface Seen {
  record: WebRecord;
  claim: WebClaim;
}

function designations(claims: Seen[]): string[] {
  const out = new Set<string>();
  for (const { claim } of claims) {
    for (const match of `${claim.text} ${claim.quote}`.matchAll(
      /\bABPP(?:[-\u2013]\s?[A-Z]{2,4})?\b/g,
    )) {
      out.add(match[0].replace(/\u2013/, '-'));
    }
  }
  return [...out];
}

/** An official site or registry that was searched in this run. */
export interface SearchedSource {
  label: string;
  topics: readonly WebClaimTopic[];
}

export function verifyClaims(
  records: readonly WebRecord[],
  searched: readonly SearchedSource[],
): WebVerification[] {
  const byTopic = new Map<WebClaimTopic, Seen[]>();
  for (const record of records) {
    if (!tied(record)) continue;
    for (const claim of record.claims) {
      if (!claim.topic) continue;
      if (!VERIFIED_TOPICS.includes(claim.topic)) continue;
      const list = byTopic.get(claim.topic) ?? [];
      list.push({ record, claim });
      byTopic.set(claim.topic, list);
    }
  }
  // A page from an official source counts for its own topics even when no
  // sentence matched a rule: the listing itself is the statement.
  for (const record of records) {
    if (!tied(record) || record.read !== 'read') continue;
    const official = officialSourceFor(record.url);
    if (!official) continue;
    for (const topic of official.topics) {
      if (!VERIFIED_TOPICS.includes(topic)) continue;
      const list = byTopic.get(topic) ?? [];
      if (list.some((entry) => entry.record.id === record.id)) continue;
      list.push({
        record,
        claim: {
          type: 'credential',
          text: `${TOPIC_LABEL[topic]}: ${record.title}`,
          quote: record.match.quote ?? record.summary,
          topic,
          basis: 'primary_source',
          from: 'page',
        },
      });
      byTopic.set(topic, list);
    }
  }

  const verifications: WebVerification[] = [];
  for (const topic of VERIFIED_TOPICS) {
    const seen = byTopic.get(topic);
    if (!seen || seen.length === 0) continue;
    const official = seen.find(
      (entry) =>
        entry.claim.basis === 'primary_source' &&
        entry.record.read === 'read' &&
        entry.claim.from !== 'snippet',
    );
    const claimed = seen.filter(
      (entry) => entry.claim.basis !== 'primary_source',
    );
    const names = designations(seen);
    const orgs = organizationsIn(
      seen.map((entry) => entry.claim.quote).join(' '),
    );
    const label =
      topic === 'board_certification'
        ? names.length > 0
          ? `Board certification (${names.join(', ')})`
          : 'Board certification'
        : TOPIC_LABEL[topic];
    const claimedAt = [
      ...new Set(claimed.map((entry) => entry.record.url)),
    ].slice(0, 8);
    if (official) {
      const source = officialSourceFor(official.record.url);
      verifications.push({
        id: `v-${topic}`,
        topic,
        claim: label,
        status: 'confirmed',
        claimedAt,
        confirmedBy: {
          name: source?.name ?? official.record.title,
          url: official.record.url,
          quote: official.claim.quote || official.record.match.quote,
        },
        note: `A page from ${source?.name ?? 'the issuing body'} was read and lists this person.`,
      });
      continue;
    }
    const wantedHosts =
      topic === 'board_certification'
        ? orgs
            .map((org) => org.acronym)
            .filter((acronym): acronym is string => Boolean(acronym))
        : [];
    const searchedHosts = searched
      .filter((entry) => entry.topics.includes(topic))
      .map((entry) => entry.label);
    const searchedOfficial = searchedHosts.length > 0;
    verifications.push({
      id: `v-${topic}`,
      topic,
      claim: label,
      status: searchedOfficial ? 'not_confirmed' : 'not_checked',
      claimedAt,
      confirmedBy: null,
      note: searchedOfficial
        ? `${claimed.length} page(s) state this${wantedHosts.length > 0 ? ` (${wantedHosts.join(', ')})` : ''}. The issuing body's own site was searched (${searchedHosts.join(', ')}) but no page listing this person could be read, so the claim is reported as made and not confirmed at the source.`
        : `${claimed.length} page(s) state this. The issuing body's own site was not searched in this run, so the claim is reported as made and not confirmed at the source.`,
    });
  }
  return verifications;
}
