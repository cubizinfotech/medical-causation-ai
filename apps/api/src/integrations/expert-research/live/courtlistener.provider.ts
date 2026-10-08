import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import {
  COURTLISTENER_SITE,
  htmlToText,
  type CourtListenerClient,
  type CourtListenerSearchHit,
} from './courtlistener.client';
import type {
  ExpertIdentityResolver,
  ResolvedExpertIdentity,
} from './identity-resolver';
import {
  LiveResearchProvider,
  mapWithLimit,
  type LiveRunResult,
} from './live-provider.base';
import {
  capitalizeName,
  displayName,
  parsePersonName,
  type PersonName,
} from './person-name';
import { specialtySearchTerms } from './specialty-match';

/** Words that mark an admissibility challenge to expert testimony. */
export const CHALLENGE_TERMS = [
  'Daubert',
  'Frye',
  '"Rule 702"',
  '"motion to exclude"',
  '"motion in limine"',
  '"motion to strike"',
  '"exclude the testimony"',
  '"exclude the opinions"',
  '"exclude his testimony"',
  '"exclude her testimony"',
  'admissibility',
];

const MAX_HITS = 30;
const MAX_TEXT_FETCHES = 6;
const EXCERPT_RADIUS = 450;
const MAX_EXCERPTS = 4;

export type ChallengeStandard = 'daubert' | 'frye' | 'rule_702' | 'unspecified';

/** Stored on challenge items; the outcome is filled in only from the court's words. */
export interface RawExpertChallenge {
  standard: ChallengeStandard;
  outcome: 'not_determined';
  role: 'unclear';
  quote: null;
  basis: 'not_determined';
  excerpts: string[];
  excerptSource: 'opinion_text' | 'search_snippet';
}

interface Hit {
  hit: CourtListenerSearchHit;
  challenge: boolean;
  /** Highlighted snippets from each search that returned the opinion. */
  snippets: string[];
}

/**
 * CourtListener case law. An opinion is kept only when it contains the
 * expert's full name and a word for the expert's specialty. Opinions that
 * also contain Daubert, Frye, Rule 702, or motion-to-exclude language are
 * marked as possible admissibility challenges; their outcome is decided
 * later, and only from the court's own words.
 */
export class CourtListenerResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly resolver: ExpertIdentityResolver,
    private readonly client: CourtListenerClient,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    const name = parsePersonName(query.expertName);
    const specialtyTerms = specialtySearchTerms(query.specialty);
    if (!name) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. Court records are searched by the expert’s full name, so a first and last name are needed.',
      };
    }
    if (specialtyTerms.length === 0) {
      return {
        items: [],
        status: 'unavailable',
        message: `Not searched. “${query.specialty}” is too general to tell same-name people apart in court opinions.`,
      };
    }

    const identity = await this.identity(query);
    const names = nameClause(name, identity);
    const base = `(${names}) AND (${specialtyTerms.join(' OR ')})`;
    const [challenges, mentions] = await Promise.all([
      this.client.searchOpinions(
        `${base} AND (${CHALLENGE_TERMS.join(' OR ')})`,
      ),
      this.client.searchOpinions(base),
    ]);

    const hits = mergeHits(challenges.hits, mentions.hits);
    if (hits.length === 0) {
      return {
        items: [],
        message: `No CourtListener opinion contains ${displayName(name)} together with ${query.specialty} terms. Federal and state opinions only; trial-court rulings and transcripts are often not published.`,
      };
    }

    const excerpts = await this.excerpts(hits, name);
    const items = hits.map((entry) =>
      this.toItem(entry, query, name, excerpts.get(entry.hit), retrievedAt),
    );
    const challengeCount = hits.filter((entry) => entry.challenge).length;
    return {
      items,
      message: `${hits.length} opinion(s) contain ${displayName(name)} with ${query.specialty} terms${challengeCount > 0 ? `; ${challengeCount} also mention an admissibility challenge (Daubert, Frye, Rule 702, or a motion to exclude)` : ''}.${this.client.canReadOpinions ? '' : ' Opinion text was not read (no CourtListener API token), so rulings are judged from search excerpts only.'}`,
    };
  }

  private async identity(
    query: ExpertResearchQuery,
  ): Promise<ResolvedExpertIdentity | null> {
    try {
      return await this.resolver.resolve(query);
    } catch {
      return null;
    }
  }

  /** Paragraphs around the expert's surname, read from the opinion text. */
  private async excerpts(
    hits: Hit[],
    name: PersonName,
  ): Promise<Map<CourtListenerSearchHit, string[]>> {
    const found = new Map<CourtListenerSearchHit, string[]>();
    if (!this.client.canReadOpinions) return found;
    const targets = hits
      .filter((entry) => entry.challenge && entry.hit.opinions?.[0]?.id)
      .slice(0, MAX_TEXT_FETCHES);
    await mapWithLimit(targets, 2, async ({ hit }) => {
      try {
        const text = await this.client.opinionText(hit.opinions![0].id!);
        const windows = excerptsAround(text, name.last);
        if (windows.length > 0) found.set(hit, windows);
      } catch {
        // The search excerpt is used instead.
      }
    });
    return found;
  }

  private toItem(
    { hit, challenge, snippets }: Hit,
    query: ExpertResearchQuery,
    name: PersonName,
    opinionExcerpts: string[] | undefined,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const caseName =
      hit.caseName?.trim() || hit.caseNameFull?.trim() || 'Unnamed case';
    const date = hit.dateFiled?.trim() || null;
    const snippet = snippets.join(' … ') || null;
    const citation = (hit.citation ?? []).filter(Boolean);
    const url = hit.absolute_url
      ? `${COURTLISTENER_SITE}${hit.absolute_url}`
      : undefined;
    const excerpts = opinionExcerpts ?? snippets;
    const who = displayName(name);
    const rawChallenge: RawExpertChallenge | undefined = challenge
      ? {
          standard: detectStandard([snippet ?? '', ...excerpts].join(' ')),
          outcome: 'not_determined',
          role: 'unclear',
          quote: null,
          basis: 'not_determined',
          excerpts,
          excerptSource: opinionExcerpts ? 'opinion_text' : 'search_snippet',
        }
      : undefined;
    const summary = [
      challenge
        ? `The opinion contains ${who}, a ${query.specialty} term, and admissibility-challenge language (Daubert, Frye, Rule 702, or a motion to exclude). Whether the challenge was about this expert, and how the court ruled, is reported only when the court’s words say so.`
        : `The opinion contains ${who} and a ${query.specialty} term. The expert’s role in the case (witness, treating physician, or party) was not determined.`,
      snippet ? `Search excerpt: “${snippet}”` : null,
    ]
      .filter(Boolean)
      .join(' ');
    return this.item({
      category: 'legal',
      title: `${caseName}${date ? ` (${date.slice(0, 4)})` : ''}`,
      summary,
      url,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        identity: {
          name: query.expertName,
          specialty: query.specialty,
          verifiedBy: 'source_match',
          basis: ['full name in opinion', 'specialty term in opinion'],
        },
        documentType: challenge ? 'expert_witness_case' : 'case',
        caseName,
        caseNumber: hit.docketNumber?.trim() || null,
        court: hit.court?.trim() || null,
        filingDate: date,
        documentDate: date,
        citation: citation.join('; ') || null,
        relevance: challenge
          ? 'Opinion mentions the expert together with an admissibility challenge.'
          : 'Opinion mentions the expert by full name with the specialty.',
        findingsRegardingExpert:
          'Not determined from the search result. Read the opinion.',
        evidenceReference: `${caseName}, ${citation[0] ?? hit.court_citation_string ?? hit.court ?? 'CourtListener'}${date ? ` (${date})` : ''}`,
        courtListenerClusterId: hit.cluster_id ?? null,
        searchSnippet: snippet,
        ...(rawChallenge ? { challenge: rawChallenge } : {}),
      },
    });
  }
}

/**
 * Phrases for the expert's name, e.g. ("Jane Smith" OR "Jane A. Smith").
 * A confirmed NPI record adds its registered first and middle names
 * ("Ravi Tikoo" OR "Ravinder Tikoo").
 */
function nameClause(
  name: PersonName,
  identity: ResolvedExpertIdentity | null,
): string {
  const middles = new Set<string>(name.middle.slice(0, 1));
  const firsts = new Set<string>([name.first]);
  const registered = identity?.record?.names[0];
  if (registered?.middle[0]) middles.add(registered.middle[0]);
  if (registered && registered.first.length > 1) firsts.add(registered.first);
  const last = capitalizeName(name.last);
  const phrases = new Set<string>();
  for (const firstName of firsts) {
    const first = capitalizeName(firstName);
    phrases.add(`"${first} ${last}"`);
    for (const middle of middles) {
      phrases.add(`"${first} ${middle[0].toUpperCase()}. ${last}"`);
      if (middle.length > 1) {
        phrases.add(`"${first} ${capitalizeName(middle)} ${last}"`);
      }
    }
  }
  return [...phrases].join(' OR ');
}

/**
 * One entry per opinion. The two searches highlight different words, so an
 * opinion found by both keeps both snippets.
 */
function mergeHits(
  challenges: CourtListenerSearchHit[],
  mentions: CourtListenerSearchHit[],
): Hit[] {
  const byKey = new Map<string, Hit>();
  const add = (hit: CourtListenerSearchHit, challenge: boolean) => {
    const key = String(hit.cluster_id ?? hit.absolute_url ?? hit.caseName);
    const snippet = cleanSnippet(hit.opinions?.[0]?.snippet);
    const existing = byKey.get(key);
    if (existing) {
      if (snippet && !existing.snippets.includes(snippet)) {
        existing.snippets.push(snippet);
      }
      return;
    }
    byKey.set(key, { hit, challenge, snippets: snippet ? [snippet] : [] });
  };
  for (const hit of challenges) add(hit, true);
  for (const hit of mentions) add(hit, false);
  return [...byKey.values()].slice(0, MAX_HITS);
}

function cleanSnippet(snippet: string | undefined): string | null {
  if (!snippet) return null;
  const text = htmlToText(snippet).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

export function detectStandard(text: string): ChallengeStandard {
  if (/\bdaubert\b/i.test(text)) return 'daubert';
  if (/\bfrye\b/i.test(text)) return 'frye';
  if (/\brule\s+702\b/i.test(text)) return 'rule_702';
  return 'unspecified';
}

const CHALLENGE_WORDS =
  /exclu|strik|preclud|daubert|frye|702|limine|admissib|reliab|qualif|grant|den(?:y|ied)/gi;

/**
 * Verbatim windows of the opinion around each mention of the surname.
 * Windows that also contain ruling language are preferred.
 */
export function excerptsAround(
  text: string,
  surname: string,
  radius = EXCERPT_RADIUS,
  max = MAX_EXCERPTS,
): string[] {
  const escaped = surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
  const windows: Array<[number, number]> = [];
  for (const match of text.matchAll(pattern)) {
    const start = Math.max(0, (match.index ?? 0) - radius);
    const end = Math.min(
      text.length,
      (match.index ?? 0) + match[0].length + radius,
    );
    const last = windows[windows.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else windows.push([start, end]);
  }
  return windows
    .map(([start, end], order) => {
      const slice = trimToWords(text, start, end);
      return {
        order,
        slice,
        score: (slice.match(CHALLENGE_WORDS) ?? []).length,
      };
    })
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, max)
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.slice);
}

function trimToWords(text: string, start: number, end: number): string {
  let from = start;
  let to = end;
  if (from > 0) {
    const space = text.indexOf(' ', from);
    if (space !== -1 && space < to) from = space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(' ', to);
    if (space > from) to = space;
  }
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
}
