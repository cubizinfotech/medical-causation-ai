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
import {
  classifyCourtDocument,
  courtLevelOf,
  DOCKET_COVERAGE_NOTE,
  legalDocumentTypeFor,
  type CourtSearchKind,
} from './court-document-type';
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
import { resolveCaseCaption } from './case-caption';

export { resolveCaseCaption } from './case-caption';
export type { CaptionStatus } from './case-caption';

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

const DEFAULT_MAX_HITS = 80;
const MAX_TEXT_FETCHES = 12;
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
  searchKind: CourtSearchKind;
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
  private readonly maxHits: number;

  constructor(
    definition: ProviderDefinition,
    private readonly resolver: ExpertIdentityResolver,
    private readonly client: CourtListenerClient,
    maxHits?: number,
  ) {
    super(definition);
    this.maxHits = Number.isFinite(maxHits)
      ? Math.min(200, Math.max(10, Math.floor(maxHits as number)))
      : DEFAULT_MAX_HITS;
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
    const npiConfirmed =
      identity?.resolution.status === 'confirmed' && Boolean(identity.record);
    const recapQuery = npiConfirmed ? `(${names})` : base;
    const [challenges, mentions, recap] = await Promise.all([
      this.client.searchOpinions(
        `${base} AND (${CHALLENGE_TERMS.join(' OR ')})`,
      ),
      this.client.searchOpinions(base),
      this.searchRecap(recapQuery),
    ]);

    const hits = mergeHits(
      challenges.hits,
      mentions.hits,
      recap.hits,
      this.maxHits,
    );
    if (hits.length === 0) {
      return {
        items: [],
        message: `No CourtListener opinion or public RECAP filing contains ${displayName(name)} together with ${query.specialty} terms. Federal and state opinions and public PACER filings only; a complete case docket was not reviewed. Trial-court rulings and transcripts are often not published.`,
      };
    }

    const excerpts = await this.excerpts(hits, name);
    const items = hits.map((entry) =>
      this.toItem(
        entry,
        query,
        name,
        excerpts.get(entry.hit),
        retrievedAt,
        npiConfirmed,
      ),
    );
    const challengeCount = hits.filter((entry) => entry.challenge).length;
    const opinions = hits.filter(
      (entry) => entry.searchKind === 'opinion',
    ).length;
    const filings = hits.length - opinions;
    return {
      items,
      message: [
        `${opinions} opinion(s) contain ${displayName(name)} with ${query.specialty} terms`,
        filings > 0
          ? `; ${filings} public RECAP filing(s) (motions, orders, pleadings, or transcripts)`
          : '',
        challengeCount > 0
          ? `; ${challengeCount} also mention an admissibility challenge (Daubert, Frye, Rule 702, or a motion to exclude)`
          : '',
        '. Published opinions are not a complete case docket.',
        this.client.canReadOpinions
          ? ''
          : ' Opinion and filing text was not read (no CourtListener API token), so rulings are judged from search excerpts only.',
        recap.limited ? ` ${recap.limited}` : '',
      ].join(''),
    };
  }

  private async searchRecap(
    base: string,
  ): Promise<{ hits: CourtListenerSearchHit[]; limited?: string }> {
    try {
      const found = await this.client.searchRecapDocuments(base);
      return { hits: found.hits };
    } catch {
      return {
        hits: [],
        limited:
          'Public RECAP filings could not be searched; that is not a finding that none exist.',
      };
    }
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
    const opinionTargets = hits
      .filter((entry) => entry.challenge && entry.hit.opinions?.[0]?.id)
      .slice(0, MAX_TEXT_FETCHES);
    const recapTargets = hits
      .filter(
        (entry) =>
          entry.searchKind === 'recap_document' &&
          entry.hit.is_available !== false &&
          typeof entry.hit.id === 'number',
      )
      .slice(0, MAX_TEXT_FETCHES);
    await mapWithLimit(
      [...opinionTargets, ...recapTargets].slice(0, MAX_TEXT_FETCHES),
      2,
      async (entry) => {
        try {
          const text =
            entry.searchKind === 'recap_document' &&
            typeof entry.hit.id === 'number'
              ? await this.client.recapDocumentText(entry.hit.id)
              : await this.client.opinionText(entry.hit.opinions![0].id!);
          const windows = excerptsAround(text, name.last);
          if (windows.length > 0) found.set(entry.hit, windows);
        } catch {
          // The search excerpt is used instead.
        }
      },
    );
    return found;
  }

  private toItem(
    { hit, challenge, snippets, searchKind }: Hit,
    query: ExpertResearchQuery,
    name: PersonName,
    opinionExcerpts: string[] | undefined,
    retrievedAt: string,
    npiConfirmed: boolean,
  ): ExpertEvidenceItem {
    const caption = resolveCaseCaption(hit);
    const caseName = caption.name;
    const date = hit.dateFiled?.trim() || null;
    const snippet = snippets.join(' … ') || hit.snippet || null;
    const citation = (hit.citation ?? []).filter(Boolean);
    const url = hit.absolute_url
      ? `${COURTLISTENER_SITE}${hit.absolute_url}`
      : undefined;
    const excerpts = opinionExcerpts ?? snippets;
    const who = displayName(name);
    const docClass = classifyCourtDocument({
      searchKind,
      title: caseName,
      description: hit.description ?? snippet ?? undefined,
      documentNumber:
        hit.document_number != null ? String(hit.document_number) : undefined,
      snippet: snippet ?? hit.snippet ?? undefined,
      court: hit.court,
    });
    const documentType = legalDocumentTypeFor(docClass, challenge);
    const courtLevel = courtLevelOf(hit.court);
    const filingText = `${snippet ?? ''} ${hit.description ?? ''} ${caseName}`;
    const specialtyInText = specialtyMentioned(filingText, query.specialty);
    const recapSupported =
      specialtyInText || recapHasSupportingIdentity(filingText, query);
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
    const kindLabel =
      searchKind === 'opinion'
        ? 'published opinion'
        : docClass === 'other'
          ? 'public RECAP filing'
          : `public ${docClass}`;
    const retrievalStatus = opinionExcerpts
      ? 'full_text'
      : snippet
        ? 'snippet_only'
        : 'metadata_only';
    const summary = [
      challenge
        ? `This ${kindLabel} contains ${who}, a ${query.specialty} term, and admissibility-challenge language (Daubert, Frye, Rule 702, or a motion to exclude). Whether the challenge was about this expert, and how the court ruled, is reported only when the court’s words say so.`
        : `This ${kindLabel} contains ${who}${specialtyInText ? ` and a ${query.specialty} term` : recapSupported && npiConfirmed && searchKind === 'recap_document' ? ' (name search after NPI identity was confirmed, with a professional or place marker on the filing)' : npiConfirmed && searchKind === 'recap_document' ? ' (name search after NPI identity was confirmed; this filing does not also show the specialty, credential, or place, so identity stays unverified)' : ''}. The expert’s role in the case (witness, treating physician, or party) was not determined.`,
      snippet ? `Search excerpt: “${htmlToText(snippet)}”` : null,
      hit.description ? `Filing description: ${hit.description}.` : null,
      caption.status === 'unresolved'
        ? 'The search result did not include a case caption.'
        : null,
      retrievalStatus === 'full_text'
        ? 'Filing text was retrieved from CourtListener.'
        : retrievalStatus === 'snippet_only'
          ? 'Only a search snippet was available; the full document was not retrieved.'
          : 'Only docket metadata was available; the full document was not retrieved.',
      DOCKET_COVERAGE_NOTE,
    ]
      .filter(Boolean)
      .join(' ');
    const category =
      documentType === 'order'
        ? 'court_order'
        : documentType === 'motion' || documentType === 'pleading'
          ? 'motion'
          : documentType === 'deposition'
            ? 'deposition'
            : documentType === 'testimony'
              ? 'testimony'
              : 'legal';
    return this.item({
      category,
      title: `${hit.description ? `${hit.description} — ` : ''}${caseName}${date ? ` (${date.slice(0, 4)})` : ''}`,
      summary,
      url,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        identity: {
          name: query.expertName,
          specialty: query.specialty,
          verifiedBy: specialtyInText
            ? 'source_match'
            : recapSupported && npiConfirmed && searchKind === 'recap_document'
              ? 'npi'
              : undefined,
          ambiguous: !(
            specialtyInText ||
            (recapSupported && npiConfirmed && searchKind === 'recap_document')
          ),
          basis: specialtyInText
            ? ['full name in filing', 'specialty term in filing']
            : recapSupported && npiConfirmed && searchKind === 'recap_document'
              ? [
                  'full name in filing',
                  'NPI identity confirmed',
                  'professional or place marker on filing',
                ]
              : ['full name in filing'],
        },
        documentType,
        documentClass: docClass,
        searchKind,
        courtLevel,
        docketCoverage:
          searchKind === 'opinion' ? 'opinion_only' : 'recap_document',
        caseName,
        captionStatus: caption.status,
        caseNumber: hit.docketNumber?.trim() || null,
        court: hit.court?.trim() || null,
        filingDate: date,
        documentDate: date,
        citation: citation.join('; ') || null,
        documentNumber:
          hit.document_number != null
            ? String(hit.document_number)
            : (recapPathParts(hit.absolute_url)?.documentNumber ?? null),
        attachmentNumber:
          hit.attachment_number != null
            ? String(hit.attachment_number)
            : (recapPathParts(hit.absolute_url)?.attachmentNumber ?? null),
        retrievalStatus,
        availablePublicly: hit.is_available !== false,
        relevance: challenge
          ? 'Filing mentions the expert together with an admissibility challenge.'
          : 'Filing mentions the expert by full name.',
        findingsRegardingExpert:
          'Not determined from the search result. Read the document.',
        evidenceReference: `${caseName}, ${citation[0] ?? hit.court_citation_string ?? hit.court ?? 'CourtListener'}${date ? ` (${date})` : ''}`,
        courtListenerClusterId: hit.cluster_id ?? null,
        courtListenerDocumentId: hit.id ?? null,
        searchSnippet: snippet,
        ...(rawChallenge ? { challenge: rawChallenge } : {}),
      },
    });
  }
}

function specialtyMentioned(text: string, specialty: string): boolean {
  const stem = specialty
    .split(/[\s,/]+/)[0]
    ?.slice(0, 6)
    .toLowerCase();
  if (!stem || stem.length < 4) return false;
  return text.toLowerCase().includes(stem);
}

/** Name-only PACER hits are not treated as this expert, even after NPI. */
function recapHasSupportingIdentity(
  text: string,
  query: ExpertResearchQuery,
): boolean {
  if (specialtyMentioned(text, query.specialty)) return true;
  if (
    /\b(ph\.?d\.?|abpp|m\.?d\.?|psyd|expert witness|neuropsych|forensic)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  const hay = text.toLowerCase();
  for (const part of (query.city ?? '')
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((token) => token.length >= 2)) {
    if (part.length === 2) {
      if (new RegExp(`\\b${part}\\b`, 'i').test(text)) return true;
    } else if (hay.includes(part)) {
      return true;
    }
  }
  return false;
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
  recap: CourtListenerSearchHit[],
  maxHits = DEFAULT_MAX_HITS,
): Hit[] {
  const byKey = new Map<string, Hit>();
  const add = (
    hit: CourtListenerSearchHit,
    challenge: boolean,
    searchKind: CourtSearchKind,
  ) => {
    const key =
      searchKind === 'recap_document'
        ? recapMergeKey(hit)
        : `o:${hit.cluster_id ?? hit.absolute_url ?? hit.caseName}`;
    const snippet = cleanSnippet(hit.opinions?.[0]?.snippet ?? hit.snippet);
    const existing = byKey.get(key);
    if (existing) {
      if (snippet && !existing.snippets.includes(snippet)) {
        existing.snippets.push(snippet);
      }
      if (challenge) existing.challenge = true;
      preferPrimaryRecapAttachment(existing, hit);
      return;
    }
    byKey.set(key, {
      hit,
      challenge,
      searchKind,
      snippets: snippet ? [snippet] : [],
    });
  };
  for (const hit of challenges) add(hit, true, 'opinion');
  for (const hit of mentions) add(hit, false, 'opinion');
  for (const hit of recap)
    add(hit, recapLooksLikeChallenge(hit), 'recap_document');
  return [...byKey.values()].slice(0, maxHits);
}

function recapLooksLikeChallenge(hit: CourtListenerSearchHit): boolean {
  return CHALLENGE_TERMS.some((term) =>
    new RegExp(term.replace(/"/g, ''), 'i').test(
      `${hit.description ?? ''} ${hit.snippet ?? ''}`,
    ),
  );
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

/** Docket id, document number, and attachment from a CourtListener docket URL. */
export function recapPathParts(path: string | undefined): {
  docketId: string;
  documentNumber: string;
  attachmentNumber: string | null;
} | null {
  if (!path) return null;
  const match = path.match(/\/docket\/(\d+)\/(\d+)(?:\/(\d+))?(?:\/|$)/i);
  if (!match) return null;
  return {
    docketId: match[1],
    documentNumber: match[2],
    attachmentNumber: match[3] ?? null,
  };
}

export function recapMergeKey(hit: CourtListenerSearchHit): string {
  const fromUrl = recapPathParts(hit.absolute_url);
  const docket =
    hit.docket_id != null ? String(hit.docket_id) : fromUrl?.docketId;
  const document =
    hit.document_number != null
      ? String(hit.document_number)
      : fromUrl?.documentNumber;
  if (docket && document) return `rd:${docket}:${document}`;
  return `rd:${hit.id ?? hit.absolute_url ?? hit.description ?? hit.caseName}`;
}

function attachmentRank(hit: CourtListenerSearchHit): number {
  const stated =
    hit.attachment_number != null
      ? Number(hit.attachment_number)
      : Number(recapPathParts(hit.absolute_url)?.attachmentNumber);
  if (Number.isFinite(stated)) return stated;
  return 0;
}

function preferPrimaryRecapAttachment(
  existing: Hit,
  incoming: CourtListenerSearchHit,
): void {
  if (existing.searchKind !== 'recap_document') return;
  if (attachmentRank(incoming) < attachmentRank(existing.hit)) {
    existing.hit = incoming;
  }
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
