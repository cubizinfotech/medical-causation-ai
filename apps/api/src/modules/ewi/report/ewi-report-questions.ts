import {
  resolveCaseCaption,
  type ExpertEvidenceItem,
} from '@integrations/expert-research';
import { isWebCoverageSummary } from '@integrations/web-research';
import { isCatalogAbsenceFinding } from '../cv/cv-comparison';
import type { CvCheck } from '../cv/cv.types';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type {
  CrossExamQuestion,
  QuestionBasisKind,
  QuestionLabel,
  QuestionSource,
} from '../research/cross-exam-question.generator';

/** A question before numbering, with the facts a rewrite must keep. */
export interface QuestionDraft {
  theme: string;
  question: string;
  label: QuestionLabel;
  sources: QuestionSource[];
  evidenceBasis: string;
  /** Substrings (quote, date, outlet) a rewritten question must still contain. */
  anchors: string[];
  evidenceIds: string[];
  basisKind: QuestionBasisKind;
  relevance: string;
  excerpt?: string;
}

export const QUESTION_THEMES = [
  'Background and credentials',
  'Prior testimony and legal matters',
  'Discipline and complaints',
  'Income, funding and business ties',
  'Publications and authorship',
  'Marketing and expert-witness business',
  'Public statements and media',
  'Reviews and complaints',
  'Inconsistencies to resolve',
] as const;

const THEME_BY_CATEGORY: Array<[RegExp, (typeof QUESTION_THEMES)[number]]> = [
  [/disciplin|malpractice|complaint/, 'Discipline and complaints'],
  [
    /court|legal|deposition|order|motion|testimony|justia|pleading/,
    'Prior testimony and legal matters',
  ],
  [
    /open_payments|income|corporate|grant|patent|financial|business/,
    'Income, funding and business ties',
  ],
  [
    /publication|pubmed|openalex|crossref|orcid|author/,
    'Publications and authorship',
  ],
  [
    /advertis|ime|expert_website|directory|expertpages|seak|jurispro|dri\b|expertlaw|marketing|office/,
    'Marketing and expert-witness business',
  ],
  [/review/, 'Reviews and complaints'],
  [
    /news|blog|social|video|youtube|presentation|powerpoint|press|media/,
    'Public statements and media',
  ],
];

const WEB_KIND_THEME: Record<string, (typeof QUESTION_THEMES)[number]> = {
  news: 'Public statements and media',
  blog: 'Public statements and media',
  social: 'Public statements and media',
  video: 'Public statements and media',
  presentation: 'Public statements and media',
  court: 'Prior testimony and legal matters',
  justia: 'Prior testimony and legal matters',
  review: 'Reviews and complaints',
  corporate: 'Income, funding and business ties',
  publication: 'Publications and authorship',
  advertising: 'Marketing and expert-witness business',
  expert_website: 'Marketing and expert-witness business',
  ime: 'Marketing and expert-witness business',
  directory: 'Marketing and expert-witness business',
  profile: 'Background and credentials',
  university: 'Background and credentials',
  maps: 'Marketing and expert-witness business',
};

/** Stems that made earlier questions generic. A question using one is dropped. */
const GENERIC_STEMS =
  /\b(investigation file|collected record|collected status|finding ?key|finding f\d+|how should counsel weigh|jury should understand|this file does not|examination point|beyond what .{1,40} collected|this public (?:motion|order|recap filing|published opinion|opinion) contains|this directory lists all current|board certification is an annual certification|you are aware of that, correct|forensic psychological assessment(?:\s*&\s*neuropsychological evaluations)?\s+menu)\b/i;

const SKIP_TITLE = /web research coverage|could not be read|coverage summary/i;

const IDENTIFIER_ONLY = /^(?:npi\s*)?\d{10}$|unnamed case|^caption not listed/i;
const EMAIL_ONLY = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const STREET_ONLY =
  /^\d+\s+\w[\w\s.'-]*(?:street|st\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|road|rd\.?|lane|ln\.?|way|suite|ste\.?)\b/i;

const EMPTY_RESULT =
  /returned no record|no matching record was found|live adapter is not connected|no request was sent|not searched\./i;

const MAX_PER_RECORD = 1;
const MAX_PER_HOST_THEME = 2;
const QUOTE_MAX = 220;

export interface QuestionSourceAttempt {
  sourceId: string;
  status?: string | null;
  coverage?: string | null;
  outcome?: string | null;
  message?: string | null;
  itemCount?: number;
}

interface WebRaw {
  kind?: string;
  platform?: string;
  match?: {
    level?: string;
    quote?: string | null;
    quoteVerified?: boolean;
    basis?: string[];
  };
  publishedAt?: string | null;
  claims?: Array<{
    type?: string;
    text?: string;
    quote?: string;
    basis?: string;
  }>;
  rating?: string | null;
  read?: string;
}

/**
 * Specific, sourced questions. Every question names a fact from a collected
 * source (a quoted passage, a registry statement, a CV conflict) and says
 * where it came from. No count is targeted and nothing is padded.
 */
export function buildQuestionDrafts(input: {
  expertName: string;
  evidence: ExpertEvidenceItem[];
  discrepancies?: ExpertDiscrepancy[];
  cvCheck?: CvCheck | null;
  sourceStatuses?: QuestionSourceAttempt[];
}): QuestionDraft[] {
  const drafts: QuestionDraft[] = [];
  for (const item of input.evidence) {
    if (!isUsableEvidence(item)) continue;
    const web = (item.raw as { web?: WebRaw } | undefined)?.web;
    if (web) drafts.push(...webDrafts(item, web));
    else drafts.push(...registryDrafts(item));
  }
  for (const discrepancy of input.discrepancies ?? []) {
    const draft = discrepancyDraft(discrepancy);
    if (draft) drafts.push(draft);
  }
  drafts.push(
    ...licenseGapDrafts(input.evidence, input.sourceStatuses ?? []),
    ...cvClaimDrafts(input.cvCheck ?? null, drafts),
  );
  const limitationExcerpts = new Set(
    drafts
      .filter((draft) => draft.basisKind === 'limitation')
      .map((draft) => normalize(draft.excerpt ?? ''))
      .filter(Boolean),
  );
  return drafts.filter((draft) => {
    if (draft.basisKind === 'limitation') return true;
    const excerpt = normalize(draft.excerpt ?? '');
    return !excerpt || !limitationExcerpts.has(excerpt);
  });
}

/** Drops invalid and duplicate drafts, groups by theme, and numbers them. */
export function finalizeQuestions(
  drafts: QuestionDraft[],
): CrossExamQuestion[] {
  const seen = new Set<string>();
  const perHostTheme = new Map<string, number>();
  const kept: QuestionDraft[] = [];
  for (const draft of drafts) {
    if (!isValidDraft(draft)) continue;
    const key = normalize(draft.question);
    const excerptKey = normalize(draft.excerpt ?? '').slice(0, 80);
    if (seen.has(key) || (excerptKey && seen.has(`ex:${excerptKey}`))) {
      continue;
    }
    const host = hostOf(draft.sources[0]?.url ?? '') || draft.sources[0]?.name;
    const hostTheme = `${host ?? ''}:${draft.theme}`;
    const used = perHostTheme.get(hostTheme) ?? 0;
    const capHost =
      draft.theme === 'Background and credentials' ||
      draft.theme === 'Marketing and expert-witness business';
    if (host && capHost && used >= MAX_PER_HOST_THEME) continue;
    seen.add(key);
    if (excerptKey) seen.add(`ex:${excerptKey}`);
    perHostTheme.set(hostTheme, used + 1);
    kept.push(draft);
  }
  const order = (theme: string) => {
    const index = QUESTION_THEMES.indexOf(
      theme as (typeof QUESTION_THEMES)[number],
    );
    return index === -1 ? QUESTION_THEMES.length : index;
  };
  kept.sort((a, b) => order(a.theme) - order(b.theme));
  return kept.map((draft, index) => toQuestion(draft, index + 1));
}

export function buildGroundedCrossExamQuestions(input: {
  expertName: string;
  evidence: ExpertEvidenceItem[];
  discrepancies?: ExpertDiscrepancy[];
  cvCheck?: CvCheck | null;
  sourceStatuses?: QuestionSourceAttempt[];
}): CrossExamQuestion[] {
  return finalizeQuestions(buildQuestionDrafts(input));
}

export function toQuestion(
  draft: QuestionDraft,
  number: number,
): CrossExamQuestion {
  return {
    number,
    category: draft.theme,
    question: draft.question,
    evidenceBasis: draft.evidenceBasis,
    label: draft.label,
    sources: draft.sources,
    evidenceIds: draft.evidenceIds,
    basisKind: draft.basisKind,
    relevance: draft.relevance,
    excerpt: draft.excerpt,
  };
}

export function renumberQuestions(
  questions: CrossExamQuestion[],
): CrossExamQuestion[] {
  return questions.map((question, index) => ({
    ...question,
    number: index + 1,
  }));
}

/** A newly generated draft is kept only when it is specific, sourced and linked. */
export function isIdentifierOnlyDraft(draft: QuestionDraft): boolean {
  const excerpt = (draft.excerpt ?? '').trim();
  const hay = `${draft.question} ${excerpt} ${draft.evidenceBasis}`;
  if (
    /unnamed case|caption not listed/i.test(hay) &&
    !/\b\d{1,2}:\d{2}-[a-z]{2}-\d+/i.test(hay)
  ) {
    return true;
  }
  if (IDENTIFIER_ONLY.test(excerpt) || EMAIL_ONLY.test(excerpt)) return true;
  if (isContactDump(excerpt)) return true;
  if (STREET_ONLY.test(excerpt) && excerpt.length < 80) return true;
  if (
    /^(?:[A-Z]{1,3}-?)?\d{4,8}$/i.test(excerpt) &&
    !/\b(official|board record|self-reported|disciplin|revok|suspend|current license record|produce the official)\b/i.test(
      draft.question,
    )
  ) {
    return true;
  }
  if (
    /\bnpi\b/i.test(draft.question) &&
    !/\b(license|board|discipline|malpractice|npi.?enumerat)/i.test(
      draft.question,
    )
  ) {
    return true;
  }
  return false;
}

export function isValidDraft(draft: QuestionDraft): boolean {
  const text = draft.question.trim();
  if (text.length < 30 || text.length > 700) return false;
  if (!text.endsWith('?')) return false;
  if (isIdentifierOnlyDraft(draft)) return false;
  if (isContactDump(text) || isContactDump(draft.excerpt ?? '')) return false;
  if (GENERIC_STEMS.test(text) || GENERIC_STEMS.test(draft.evidenceBasis)) {
    return false;
  }
  if (!draft.evidenceBasis.trim()) return false;
  if (!['verified', 'allegation', 'unresolved'].includes(draft.label)) {
    return false;
  }
  if (draft.evidenceIds.length === 0) return false;
  return (
    draft.sources.length > 0 &&
    draft.sources.every((source) => source.name.trim().length > 0)
  );
}

/**
 * Maps a stored question onto the draft validator so rebuild uses the same
 * identifier, contact-dump, and boilerplate rules as new generation.
 */
export function draftFromStoredQuestion(
  question: CrossExamQuestion,
): QuestionDraft {
  const sources = question.sources ?? [];
  const evidenceIds = uniqueStrings([
    ...(question.evidenceIds ?? []),
    ...sources.map((source) => source.url ?? source.name),
  ]);
  return {
    theme: question.category,
    question: question.question,
    label: question.label ?? 'unresolved',
    sources,
    evidenceBasis: question.evidenceBasis ?? '',
    anchors: question.excerpt ? [question.excerpt.slice(0, 50)] : [],
    evidenceIds,
    basisKind: question.basisKind ?? 'sourced_fact',
    relevance: question.relevance ?? '',
    excerpt: question.excerpt,
  };
}

/** A stored question is printable only when it would pass new-draft checks. */
export function questionIsGrounded(question: CrossExamQuestion): boolean {
  return isValidDraft(draftFromStoredQuestion(question));
}

function isUsableEvidence(item: ExpertEvidenceItem): boolean {
  if (isWebCoverageSummary(item)) return false;
  if (SKIP_TITLE.test(item.title)) return false;
  if (item.sourceId === 'cv_profile' || item.category === 'cv') return false;
  if (item.access === 'restricted' || item.access === 'unavailable') {
    return false;
  }
  if (item.informationStatus === 'unavailable') return false;
  const web = (item.raw as { web?: WebRaw } | undefined)?.web;
  if (web?.read === 'restricted' || web?.read === 'failed') return false;
  if (web) return true;
  if (item.identityMatch === 'uncertain') return false;
  if (EMPTY_RESULT.test(`${item.title} ${item.summary}`)) return false;
  return true;
}

export function evidenceKey(item: ExpertEvidenceItem): string {
  if (item.url) return item.url;
  return `${item.sourceId}:${item.title}`;
}

// ---------------------------------------------------------------- web pages

function webDrafts(item: ExpertEvidenceItem, web: WebRaw): QuestionDraft[] {
  const level = web.match?.level;
  if (level !== 'strong' && level !== 'possible') return [];
  if (!item.url) return [];
  const unresolved = level === 'possible';
  const host = hostOf(item.url);
  const date = isoDate(web.publishedAt ?? null);
  const stamp = date ? ` (${date})` : '';
  const theme = WEB_KIND_THEME[web.kind ?? ''] ?? 'Public statements and media';
  const source: QuestionSource = {
    name: host,
    url: item.url,
    ...(date ? { date } : {}),
  };

  const facts: Array<{ quote: string; type: string; basis?: string }> = [];
  for (const claim of web.claims ?? []) {
    const quote = clip(claim.quote ?? '', QUOTE_MAX);
    if (quote.length >= 20) {
      facts.push({
        quote,
        type: claim.type ?? 'other',
        ...(claim.basis ? { basis: claim.basis } : {}),
      });
    }
  }
  const tie = clip(web.match?.quote ?? '', QUOTE_MAX);
  if (facts.length === 0 && tie.length >= 20 && web.match?.quoteVerified) {
    facts.push({ quote: tie, type: 'other' });
  }

  const drafts: QuestionDraft[] = [];
  const used = new Set<string>();
  for (const fact of facts) {
    if (drafts.length >= MAX_PER_RECORD) break;
    const key = normalize(fact.quote);
    if (used.has(key)) continue;
    used.add(key);
    if (isIdentifierQuote(fact.quote)) continue;
    const allegation = fact.type === 'allegation' || web.kind === 'review';
    const label: QuestionLabel = unresolved
      ? 'unresolved'
      : allegation
        ? 'allegation'
        : 'verified';
    const question = webQuestion({
      kind: web.kind ?? 'other',
      type: fact.type,
      quote: fact.quote,
      title: clip(item.title, 120),
      host,
      platform: web.platform,
      stamp,
      unresolved,
      rating: web.rating ?? null,
      basis: fact.basis,
    });
    const basisKind: QuestionBasisKind = unresolved
      ? 'evidence_gap'
      : allegation
        ? 'sourced_fact'
        : 'sourced_fact';
    const relevance = unresolved
      ? 'The page only partly matches this expert, so the statement is treated as unconfirmed.'
      : allegation
        ? 'A third-party report; it has not been adjudicated.'
        : 'A collected page about this expert states this fact.';
    drafts.push({
      theme: themeForClaim(theme, fact.type),
      question,
      label,
      sources: [source],
      evidenceBasis: [
        `${label === 'verified' ? 'Verified' : label === 'allegation' ? 'Allegation (reported, not adjudicated)' : 'Unresolved (identity or detail not confirmed)'}.`,
        `${host}${stamp}: “${fact.quote}”`,
        web.match?.basis?.length
          ? `Tied to the expert by: ${web.match.basis.slice(0, 3).join('; ')}.`
          : '',
        item.url,
      ]
        .filter(Boolean)
        .join(' '),
      anchors: [fact.quote.slice(0, 50), ...(date ? [date.slice(0, 4)] : [])],
      evidenceIds: [evidenceKey(item)],
      basisKind,
      relevance,
      excerpt: fact.quote,
    });
  }
  return drafts;
}

function webQuestion(input: {
  kind: string;
  type: string;
  quote: string;
  title: string;
  host: string;
  platform?: string;
  stamp: string;
  unresolved: boolean;
  rating: string | null;
  basis?: string;
}): string {
  const { quote, host, stamp, title } = input;
  const q = `“${quote}”`;
  if (input.unresolved) {
    return `If the ${host} page “${title}”${stamp} is about you, is this statement accurate: ${q}?`;
  }
  if (input.kind === 'review') {
    return `A review on ${host}${stamp}${input.rating ? ` rated ${input.rating}` : ''} said: ${q} Does that review describe your practice?`;
  }
  if (input.type === 'allegation') {
    return `${host} reported${stamp}: ${q} Is that allegation accurate as it concerns you?`;
  }
  if (input.kind === 'court' || input.kind === 'justia') {
    return `A court document, “${title}”${stamp}, states: ${q} Does that describe your role in that matter?`;
  }
  if (input.kind === 'news' || input.kind === 'blog') {
    return `${host} wrote${stamp}: ${q} Is that an accurate description of your work or testimony?`;
  }
  if (input.kind === 'social') {
    return `On ${input.platform ?? host}${stamp} the following appears under your name: ${q} Are those your words?`;
  }
  if (input.kind === 'video' || input.kind === 'presentation') {
    return `In “${title}”${stamp} on ${host}, the following was said or shown: ${q} Was that you?`;
  }
  if (input.basis === 'primary_source') {
    return `${host}, which records these credentials, states: ${q} Is that entry accurate?`;
  }
  if (input.basis === 'third_party' && input.type !== 'allegation') {
    return `${host}${stamp} states about you: ${q} Is that accurate?`;
  }
  if (input.type === 'advertising' || input.type === 'forensic') {
    return `${host} presents your services this way: ${q} Is that how you market yourself?`;
  }
  if (input.type === 'credential') {
    return `${host} states: ${q} Is that how you describe your credentials?`;
  }
  return `${host}${stamp} states: ${q} Is that accurate?`;
}

function isContactDump(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value);
  const hasPhone = /\b(?:tel\.?|telephone|phone)\b.{0,16}\(?\d{3}\)?/i.test(
    value,
  );
  const hasStreet =
    STREET_ONLY.test(value) ||
    /\d+\s+[\w.'-]+.+\b(?:street|st\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|road|rd\.?|lane|ln\.?|way|suite)\b/i.test(
      value,
    );
  const material =
    /\b(testif|daubert|disciplin|malpractice|revok|suspend|conflict|methodology|income|open payments|license|self-reported|nppes|board record)\b/i.test(
      value,
    );
  if (material) return false;
  if (hasEmail || hasPhone) return true;
  return hasStreet && value.length < 220;
}

function isIdentifierQuote(quote: string): boolean {
  const text = quote.trim();
  if (IDENTIFIER_ONLY.test(text) || EMAIL_ONLY.test(text)) return true;
  if (isContactDump(text)) return true;
  if (STREET_ONLY.test(text) && text.length < 80) return true;
  if (/^npi\s*\d{10}$/i.test(text)) return true;
  return false;
}

function themeForClaim(theme: string, type: string): string {
  if (type === 'advertising' || type === 'forensic') {
    return 'Marketing and expert-witness business';
  }
  if (type === 'credential') return 'Background and credentials';
  if (type === 'allegation' && theme === 'Public statements and media') {
    return 'Discipline and complaints';
  }
  return theme;
}

// ---------------------------------------------------------- registry items

function registryDrafts(item: ExpertEvidenceItem): QuestionDraft[] {
  if (item.category === 'web') return [];
  if (item.sourceId === 'cv_profile' || item.category === 'cv') return [];
  const sourceName = item.source?.name ?? item.sourceId;
  const date = isoDate(item.retrievedAt ?? item.source?.retrievedAt ?? null);
  const source: QuestionSource = {
    name: sourceName,
    ...(item.url ? { url: item.url } : {}),
    ...(date ? { date } : {}),
  };
  const id = evidenceKey(item);
  const license = registryLicenseDraft(item, source, id, date);
  if (license) return [license];
  const publication = registryPublicationDraft(item, source, id, date);
  if (publication) return [publication];
  const legal = registryLegalDraft(item, source, id, date);
  if (legal) return [legal];
  const payment = registryPaymentDraft(item, source, id, date);
  if (payment) return [payment];

  if (item.sourceId === 'npi_registry') return [];
  if (
    /this public (?:motion|order|recap filing|published opinion) contains/i.test(
      item.summary ?? '',
    )
  ) {
    return [];
  }

  const fact = clip(stripCaveats(item.summary), 240);
  if (fact.length < 40 || !item.url) return [];
  const label: QuestionLabel =
    item.informationStatus === 'verified' ? 'verified' : 'unresolved';
  return [
    sourcedDraft({
      theme: themeForCategory(item.category),
      question:
        label === 'verified'
          ? `${sourceName} records: “${fact}” Is that accurate?`
          : `${sourceName} lists, without independent confirmation: “${fact}” Can you confirm or correct that?`,
      label,
      sources: [source],
      excerpt: fact,
      evidenceIds: [id],
      basisKind: label === 'verified' ? 'sourced_fact' : 'evidence_gap',
      relevance:
        label === 'verified'
          ? 'A collected source states this about the expert.'
          : 'The source statement has not been independently confirmed.',
      date,
      url: item.url,
      sourceName,
    }),
  ];
}

function registryLicenseDraft(
  item: ExpertEvidenceItem,
  source: QuestionSource,
  id: string,
  date: string | null,
): QuestionDraft | null {
  if (item.category !== 'license' && item.sourceId !== 'state_license') {
    return null;
  }
  const raw = item.raw ?? {};
  const status = readString(raw.verificationStatus) ?? '';
  const number =
    readString(raw.licenseNumber) ??
    nppesLicenseNumber(raw) ??
    licenseNumberFromText(`${item.title} ${item.summary}`);
  if (!number) return null;
  const displayed = readString(raw.licenseStatus);
  if (status === 'nppes_self_reported') {
    const excerpt = `${number}${displayed ? ` (${displayed})` : ''}`;
    return sourcedDraft({
      theme: 'Background and credentials',
      question: `${source.name} lists license ${number} as self-reported. That registry does not verify licenses with the state board. Can you produce the official board record for ${number}?`,
      label: 'unresolved',
      sources: [source],
      excerpt,
      evidenceIds: [id],
      basisKind: 'evidence_gap',
      relevance:
        'NPPES license numbers are self-reported. Absence of an official match is not a finding that the license is invalid.',
      date,
      url: item.url,
      sourceName: source.name,
    });
  }
  const label: QuestionLabel =
    status === 'official_verified' || item.informationStatus === 'verified'
      ? 'verified'
      : 'unresolved';
  const statusBit = displayed ? ` as “${displayed}”` : '';
  return sourcedDraft({
    theme: 'Background and credentials',
    question:
      label === 'verified'
        ? `${source.name} lists license ${number}${statusBit}. Is that your current license record?`
        : `${source.name} lists license ${number}${statusBit}, without a complete official match. Can you confirm or correct that record?`,
    label,
    sources: [source],
    excerpt: `${number}${statusBit}`,
    evidenceIds: [id],
    basisKind: label === 'verified' ? 'sourced_fact' : 'evidence_gap',
    relevance:
      label === 'verified'
        ? 'Official regulator data for this license number.'
        : 'The official record was only partly matched.',
    date,
    url: item.url,
    sourceName: source.name,
  });
}

function registryPublicationDraft(
  item: ExpertEvidenceItem,
  source: QuestionSource,
  id: string,
  date: string | null,
): QuestionDraft | null {
  if (
    item.category !== 'publication' &&
    item.sourceId !== 'pubmed' &&
    item.sourceId !== 'openalex' &&
    item.sourceId !== 'crossref'
  ) {
    return null;
  }
  const raw = item.raw ?? {};
  const title = clip(item.title.replace(/^RETRACTED:\s*/i, ''), 160);
  if (title.length < 8) return null;
  const doi = readString(raw.doi);
  const pmid = readString(raw.pmid);
  const position = readString(raw.authorship) ?? readString(raw.authorPosition);
  const retracted = /retract/i.test(item.title) || raw.retractionStatus;
  const ident = doi
    ? `DOI ${doi}`
    : pmid
      ? `PMID ${pmid}`
      : (item.url ?? title);
  const role = position ? ` as ${position}` : ' as an author';
  const question = retracted
    ? `${source.name} lists “${title}” (${ident}) as retracted. You are listed${role}. Is that the work, and is the retraction status accurate?`
    : `${source.name} lists you${role} on “${title}” (${ident}). Is that authorship accurate?`;
  return sourcedDraft({
    theme: 'Publications and authorship',
    question,
    label: item.informationStatus === 'verified' ? 'verified' : 'unresolved',
    sources: [source],
    excerpt: title,
    evidenceIds: [id],
    basisKind: 'sourced_fact',
    relevance: retracted
      ? 'A collected catalog record reports a retraction and lists this expert.'
      : 'A collected catalog record lists this expert on the work.',
    date,
    url: item.url,
    sourceName: source.name,
  });
}

function registryLegalDraft(
  item: ExpertEvidenceItem,
  source: QuestionSource,
  id: string,
  date: string | null,
): QuestionDraft | null {
  const legal =
    /legal|court_order|motion|deposition|testimony/.test(item.category) ||
    /courtlistener|justia|state_court/.test(item.sourceId);
  if (!legal) return null;
  const raw = item.raw ?? {};
  const caseName = resolveCaseCaption({
    caseName: readString(raw.caseName),
    absolute_url: item.url,
    url: item.url,
  }).name;
  if (/unnamed case/i.test(caseName) || /caption not listed/i.test(caseName)) {
    return null;
  }
  const caseNumber = readString(raw.caseNumber);
  const docType = readString(raw.documentType) ?? readString(raw.documentClass);
  const challenge = raw.challenge as { standard?: string } | undefined;
  const docket = caseNumber ? `, case ${caseNumber}` : '';
  const kind = docType ? ` (${docType})` : '';
  const question = challenge
    ? `${source.name} has “${caseName}”${docket}${kind} with admissibility-challenge language naming you. Were you the expert whose testimony was at issue in that filing?`
    : `${source.name} has “${caseName}”${docket}${kind} naming you. Were you the person named in that public filing?`;
  return sourcedDraft({
    theme: 'Prior testimony and legal matters',
    question,
    label: 'unresolved',
    sources: [source],
    excerpt: `${caseName}${docket}`,
    evidenceIds: [id],
    basisKind: 'sourced_fact',
    relevance:
      'A public filing or opinion names the expert. It is not evidence that a complete docket was reviewed.',
    date,
    url: item.url,
    sourceName: source.name,
  });
}

function registryPaymentDraft(
  item: ExpertEvidenceItem,
  source: QuestionSource,
  id: string,
  date: string | null,
): QuestionDraft | null {
  if (item.sourceId !== 'open_payments' && item.category !== 'income_bias') {
    return null;
  }
  if (!/^CMS Open Payments /.test(item.title)) return null;
  const amount = readString(item.raw?.totalAmount) ?? item.title;
  return sourcedDraft({
    theme: 'Income, funding and business ties',
    question: `${source.name} reports ${item.title}. Are those general payments yours?`,
    label: item.informationStatus === 'verified' ? 'verified' : 'unresolved',
    sources: [source],
    excerpt: String(amount),
    evidenceIds: [id],
    basisKind: 'sourced_fact',
    relevance: 'CMS Open Payments totals retrieved by confirmed NPI.',
    date,
    url: item.url,
    sourceName: source.name,
  });
}

function themeForCategory(category: string): (typeof QUESTION_THEMES)[number] {
  const text = category.toLowerCase();
  for (const [pattern, theme] of THEME_BY_CATEGORY) {
    if (pattern.test(text)) return theme;
  }
  return 'Background and credentials';
}

function stripCaveats(summary: string): string {
  return summary
    .replace(/This (page|summary) (appears|does not|names)[^.]*\.\s*/gi, '')
    .replace(/Possible match:[^.]*\.\s*/gi, '')
    .replace(/This is a public filing or published opinion\.[^.]*\.\s*/gi, '')
    .replace(/This is official regulator data[^.]*\.\s*/gi, '')
    .trim();
}

// ----------------------------------------------------------- discrepancies

function discrepancyDraft(
  discrepancy: ExpertDiscrepancy,
): QuestionDraft | null {
  if (
    discrepancy.label === 'verified' ||
    discrepancy.label === 'unable_to_verify' ||
    isCatalogAbsenceFinding(discrepancy)
  ) {
    return null;
  }
  if (
    discrepancy.field === 'publication' &&
    discrepancy.label !== 'conflicting'
  ) {
    return null;
  }
  const description = clip(discrepancy.description, 320);
  if (description.length < 30) return null;
  const sources = mergeSources(
    discrepancy.sources.map((entry) => ({
      name: entry.sourceName,
      ...(entry.url ? { url: entry.url } : {}),
      ...(entry.retrievedAt
        ? { date: isoDate(entry.retrievedAt) ?? undefined }
        : {}),
    })),
    namedDiscrepancySources(discrepancy),
  );
  const evidenceIds = uniqueStrings([
    ...discrepancy.evidenceIds,
    discrepancy.id,
    ...discrepancy.relatedUrls,
  ]);
  const cvBit = discrepancy.cvSource ? ` ${discrepancy.cvSource}` : '';
  return {
    theme: 'Inconsistencies to resolve',
    question: `${description} How do you reconcile those statements?`,
    label: 'unresolved',
    sources,
    evidenceBasis: `Confirmed inconsistency in collected sources: ${discrepancy.title}. ${description}${
      sources[0]?.url ? ` ${sources[0].url}` : ''
    }`,
    anchors: [description.slice(0, 40)],
    evidenceIds,
    basisKind: 'inconsistency',
    relevance: `Two collected sources disagree${cvBit}. This is a source conflict, not a finding of misconduct.`,
    excerpt: description,
  };
}

function namedDiscrepancySources(
  discrepancy: ExpertDiscrepancy,
): QuestionSource[] {
  const names = [discrepancy.supportingSource, discrepancy.cvSource].filter(
    (name): name is string => Boolean(name),
  );
  const urls = discrepancy.relatedUrls;
  if (names.length === 0) {
    return [
      {
        name: 'Source comparison',
        ...(urls[0] ? { url: urls[0] } : {}),
      },
    ];
  }
  return names.map((name, index) => ({
    name,
    ...(urls[index] ? { url: urls[index] } : {}),
  }));
}

function licenseGapDrafts(
  evidence: ExpertEvidenceItem[],
  statuses: QuestionSourceAttempt[],
): QuestionDraft[] {
  const nppes = evidence.find(
    (item) =>
      isUsableEvidence(item) &&
      readString(item.raw?.verificationStatus) === 'nppes_self_reported',
  );
  if (!nppes) return [];
  if (evidence.some((item) => item.sourceId === 'state_license')) return [];
  const official = statuses.find(
    (status) => status.sourceId === 'state_license',
  );
  const coverage = official?.coverage ?? '';
  if (
    coverage !== 'searched_no_results' &&
    coverage !== 'blocked_or_access_denied' &&
    official?.outcome !== 'restricted'
  ) {
    return [];
  }
  const number = nppesLicenseNumber(nppes.raw ?? {}) ?? 'the listed number';
  const limitation =
    coverage === 'blocked_or_access_denied' ||
    official?.outcome === 'restricted'
      ? 'The official state-board lookup could not be read'
      : coverage === 'searched_no_results'
        ? 'The official state-board lookup displayed no matching record'
        : 'The official state-board lookup was not completed';
  const source: QuestionSource = {
    name: nppes.source?.name ?? 'NPI Registry (NPPES)',
    ...(nppes.url ? { url: nppes.url } : {}),
  };
  return [
    sourcedDraft({
      theme: 'Background and credentials',
      question: `NPPES lists license ${number} as self-reported. ${limitation}. That is not a finding that the license is invalid. Can you produce the official board verification for ${number}?`,
      label: 'unresolved',
      sources: [source],
      excerpt: String(number),
      evidenceIds: [evidenceKey(nppes)],
      basisKind: 'limitation',
      relevance:
        'Self-reported NPPES details are not official verification. A missed or blocked board lookup does not prove the license is absent.',
      date: isoDate(nppes.retrievedAt ?? nppes.source?.retrievedAt ?? null),
      url: nppes.url,
      sourceName: source.name,
    }),
  ];
}

function cvClaimDrafts(
  check: CvCheck | null,
  existing: QuestionDraft[],
): QuestionDraft[] {
  if (!check) return [];
  const already = existing.map((draft) => normalize(draft.question)).join(' ');
  const wanted = new Set(['license', 'board_certification', 'education']);
  const drafts: QuestionDraft[] = [];
  const seenCategory = new Set<string>();
  for (const claim of check.claims) {
    if (!wanted.has(claim.category)) continue;
    if (seenCategory.has(claim.category)) continue;
    if (claim.quote.trim().length < 20) continue;
    const key = normalize(claim.quote);
    if (
      already.includes(key) ||
      drafts.some((d) => normalize(d.excerpt ?? '').includes(key))
    ) {
      continue;
    }
    const compared = check.comparisons.some(
      (row) =>
        row.cv?.claimId === claim.id &&
        (row.label === 'verified' || row.label === 'conflicting'),
    );
    if (compared) continue;
    seenCategory.add(claim.category);
    const page = claim.page;
    drafts.push({
      theme: 'Background and credentials',
      question: `Your uploaded CV, page ${page}, states: “${clip(claim.quote, 180)}” That statement has not been independently verified in this investigation. Is it accurate?`,
      label: 'unresolved',
      sources: [
        {
          name: `Uploaded CV: ${check.document.name}`,
        },
      ],
      evidenceBasis: `Uploaded CV, page ${page}: “${clip(claim.quote, 180)}”. Not independently verified.`,
      anchors: [claim.quote.slice(0, 40), `page ${page}`],
      evidenceIds: [`cv:${check.document.name}:page-${page}:${claim.id}`],
      basisKind: 'evidence_gap',
      relevance:
        'The statement appears on the uploaded CV. It is not an independent verification.',
      excerpt: claim.quote,
    });
    if (drafts.length >= 4) break;
  }
  return drafts;
}

function sourcedDraft(input: {
  theme: string;
  question: string;
  label: QuestionLabel;
  sources: QuestionSource[];
  excerpt: string;
  evidenceIds: string[];
  basisKind: QuestionBasisKind;
  relevance: string;
  date: string | null;
  url?: string;
  sourceName: string;
}): QuestionDraft {
  return {
    theme: input.theme,
    question: input.question,
    label: input.label,
    sources: input.sources,
    evidenceBasis: [
      input.label === 'verified'
        ? 'Verified by the source.'
        : input.basisKind === 'limitation'
          ? 'Research limitation; not a finding that nothing exists.'
          : input.basisKind === 'evidence_gap'
            ? 'Unresolved: the source statement was not independently confirmed.'
            : 'Collected source statement.',
      `${input.sourceName}${input.date ? ` (retrieved ${input.date})` : ''}: “${input.excerpt}”`,
      input.url,
    ]
      .filter(Boolean)
      .join(' '),
    anchors: [input.excerpt.slice(0, 40)],
    evidenceIds: input.evidenceIds,
    basisKind: input.basisKind,
    relevance: input.relevance,
    excerpt: input.excerpt,
  };
}

// ----------------------------------------------------------------- helpers

export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toISOString().slice(0, 10)
    : null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function mergeSources(...lists: QuestionSource[][]): QuestionSource[] {
  const seen = new Set<string>();
  const out: QuestionSource[] = [];
  for (const list of lists) {
    for (const source of list) {
      const key = `${normalize(source.name)}|${source.url ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(source);
    }
  }
  return out;
}

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function nppesLicenseNumber(raw: Record<string, unknown>): string | null {
  const list = raw.nppesLicenses;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0] as { number?: unknown };
  return readString(first?.number);
}

function licenseNumberFromText(text: string): string | null {
  const match = text.match(/\b([A-Z]{1,3}\d{3,8}|PSY\d{4,}|[A-Z]\d{4,8})\b/i);
  return match?.[1] ?? null;
}
