import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import { scoreOrcidCandidate } from './orcid-match';
import {
  escapeSolr,
  OrcidClient,
  orcidProfileUrl,
  parseOrcidId,
  type OrcidRecord,
  type OrcidSearchHit,
  type OrcidWork,
} from './orcid.client';
import { parsePersonName } from './person-name';

const MAX_CANDIDATES = 5;
const MAX_WORKS = 12;

/**
 * ORCID Public API. A name hit is a candidate until affiliation, specialty,
 * a supplied iD, or a named publication identifier also agrees. Works from
 * unconfirmed profiles are not attributed.
 */
export class OrcidResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly client: OrcidClient,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    if (!this.client.configured()) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. ORCID is not configured (no API key). Register a free Public API client at https://orcid.org/developer-tools and set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET.',
      };
    }
    const expert = parsePersonName(query.expertName);
    if (!expert) {
      return {
        items: [],
        status: 'unavailable',
        message: 'Not searched. ORCID needs the expert’s first and last name.',
      };
    }

    const hits = await this.searchHits(query, expert);
    if (hits.length === 0) {
      return {
        items: [],
        message: `ORCID public search returned no researcher matching ${query.expertName}. This is not proof that the expert has no ORCID iD.`,
      };
    }

    const records = new Map<string, OrcidRecord | null>();
    const toFetch = hits.slice(0, MAX_CANDIDATES);
    for (const hit of toFetch) {
      records.set(hit.orcid, await this.client.record(hit.orcid));
    }

    const scored = hits.map((hit) =>
      scoreOrcidCandidate(query, expert, hit, records.get(hit.orcid) ?? null),
    );
    const confirmed = scored.filter((entry) => entry.kind === 'confirmed');
    const candidates = scored.filter((entry) => entry.kind === 'candidate');

    if (confirmed.length > 1) {
      return {
        items: confirmed.map((entry) =>
          this.profileItem(
            entry.orcid,
            records.get(entry.orcid) ?? null,
            hits.find((hit) => hit.orcid === entry.orcid)!,
            retrievedAt,
            true,
            entry.reasons,
          ),
        ),
        outcome: 'conflicting',
        message: `ORCID returned ${confirmed.length} public profiles that could fit ${query.expertName} (${confirmed.map((entry) => entry.orcid).join(', ')}). None was attributed. Add the ORCID iD or an affiliation to distinguish them.`,
      };
    }

    if (confirmed.length === 1) {
      const match = confirmed[0];
      const record = records.get(match.orcid) ?? null;
      const hit = hits.find((entry) => entry.orcid === match.orcid)!;
      const profile = this.profileItem(
        match.orcid,
        record,
        hit,
        retrievedAt,
        false,
        match.reasons,
      );
      const works = (record?.works ?? [])
        .slice(0, MAX_WORKS)
        .map((work) => this.workItem(match.orcid, work, retrievedAt, query));
      return {
        items: [profile, ...works],
        message: [
          `ORCID profile ${match.orcid} was corroborated by ${match.reasons.join(', ')}.`,
          works.length > 0
            ? `${works.length} public work(s) from that profile were listed. Being on an ORCID record is not independent proof of authorship unless the work lists contributors.`
            : 'The public record listed no works.',
        ].join(' '),
      };
    }

    return {
      items: candidates.slice(0, MAX_CANDIDATES).map((entry) =>
        this.profileItem(
          entry.orcid,
          records.get(entry.orcid) ?? null,
          hits.find((hit) => hit.orcid === entry.orcid)!,
          retrievedAt,
          true,
          entry.reasons,
        ),
      ),
      outcome: candidates.length > 0 ? 'conflicting' : 'no_result',
      message:
        candidates.length > 0
          ? `ORCID found ${candidates.length} same-name public profile(s) for ${query.expertName}, but none had a matching affiliation, specialty, supplied iD, or named publication. They were kept as candidates and their works were not merged.`
          : `ORCID returned ${hits.length} hit(s) for ${query.expertName}, but none of the public names matched the expert. Nothing was attributed.`,
    };
  }

  private async searchHits(
    query: ExpertResearchQuery,
    expert: { first: string; last: string },
  ): Promise<OrcidSearchHit[]> {
    const supplied = parseOrcidId(query.context);
    if (supplied) {
      const { hits } = await this.client.expandedSearch(`orcid:${supplied}`, 1);
      if (hits.length > 0) return hits;
    }
    const nameQuery = `family-name:${escapeSolr(expert.last)} AND given-names:${escapeSolr(expert.first)}`;
    const named = await this.client.expandedSearch(nameQuery, 8);
    if (named.hits.length > 0) return named.hits;
    const { city } = splitCity(query.city);
    if (!city) return named.hits;
    const withPlace = await this.client.expandedSearch(
      `family-name:${escapeSolr(expert.last)} AND affiliation-org-name:${escapeSolr(city)}`,
      8,
    );
    return withPlace.hits;
  }

  private profileItem(
    orcid: string,
    record: OrcidRecord | null,
    hit: OrcidSearchHit,
    retrievedAt: string,
    ambiguous: boolean,
    reasons: string[],
  ): ExpertEvidenceItem {
    const institutions = unique([
      ...hit.institutions,
      ...(record?.employments ?? []),
      ...(record?.educations ?? []),
    ]);
    const display =
      record?.creditName ||
      hit.creditName ||
      [
        hit.givenNames || record?.givenNames,
        hit.familyNames || record?.familyNames,
      ]
        .filter(Boolean)
        .join(' ') ||
      orcid;
    const otherNames = unique([
      ...(record?.otherNames ?? []),
      ...hit.otherNames,
    ]);
    return this.item({
      category: 'identity',
      title: ambiguous
        ? `Possible ORCID candidate: ${display} (${orcid})`
        : `ORCID profile: ${display} (${orcid})`,
      summary: [
        `Public ORCID record ${orcid}.`,
        institutions.length > 0
          ? `Affiliations: ${institutions.slice(0, 6).join('; ')}.`
          : 'No public affiliation was listed.',
        otherNames.length > 0
          ? `Other names: ${otherNames.slice(0, 4).join('; ')}.`
          : null,
        `Matched on ${reasons.join(', ')}.`,
        ambiguous
          ? 'Same-name candidate only; publications from this record were not attributed to the expert.'
          : 'Corroborated by more than the name. Public works from this record are listed separately.',
      ]
        .filter(Boolean)
        .join(' '),
      url: orcidProfileUrl(orcid),
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        orcid,
        identity: {
          name: display,
          city: institutions[0] ?? null,
          specialty: (record?.keywords ?? []).join(', ') || null,
          employer: record?.employments[0] ?? institutions[0] ?? null,
          education: record?.educations[0] ?? null,
          verifiedBy: ambiguous ? undefined : 'source_match',
          ambiguous,
        },
        givenNames: record?.givenNames ?? hit.givenNames,
        familyNames: record?.familyNames ?? hit.familyNames,
        otherNames,
        institutions,
        keywords: record?.keywords ?? [],
        workCount: record?.works.length ?? 0,
      },
    });
  }

  private workItem(
    orcid: string,
    work: OrcidWork,
    retrievedAt: string,
    query: ExpertResearchQuery,
  ): ExpertEvidenceItem {
    const authorsListed = work.authors.length > 0;
    return this.item({
      category: 'publication',
      title: work.title,
      summary: [
        `Public ORCID work on ${orcid}${work.year ? ` (${work.year})` : ''}.`,
        work.doi ? `DOI ${work.doi}.` : null,
        work.pmid ? `PMID ${work.pmid}.` : null,
        authorsListed
          ? `Contributors listed: ${work.authors.join(', ')}.`
          : 'The public summary does not list contributors, so this is not independent proof of authorship.',
      ]
        .filter(Boolean)
        .join(' '),
      url: work.url,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        orcid,
        doi: work.doi ?? null,
        pmid: work.pmid ?? null,
        year: work.year,
        venue: work.journal ?? null,
        publicationType: work.type ?? null,
        authors: work.authors,
        authorListIncomplete: !authorsListed,
        identity: {
          name: query.expertName,
          verifiedBy: 'source_match',
        },
      },
    });
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function splitCity(city: string): { city: string } {
  const part = city.split(',')[0]?.trim() ?? '';
  return { city: part };
}
