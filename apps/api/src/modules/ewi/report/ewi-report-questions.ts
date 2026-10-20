import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type {
  CrossExamQuestion,
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
  /\b(investigation file|collected record|collected status|finding ?key|jury should understand|this file does not|examination point|beyond what .{1,40} collected)\b/i;

const MAX_PER_RECORD = 3;
const QUOTE_MAX = 220;

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
    topic?: string;
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
}): QuestionDraft[] {
  const drafts: QuestionDraft[] = [];
  for (const item of input.evidence) {
    const web = (item.raw as { web?: WebRaw } | undefined)?.web;
    if (web) drafts.push(...webDrafts(item, web));
    else drafts.push(...registryDrafts(item));
  }
  for (const discrepancy of input.discrepancies ?? []) {
    const draft = discrepancyDraft(discrepancy);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

/** Drops invalid and duplicate drafts, groups by theme, and numbers them. */
export function finalizeQuestions(
  drafts: QuestionDraft[],
): CrossExamQuestion[] {
  const seen = new Set<string>();
  const kept: QuestionDraft[] = [];
  for (const draft of drafts) {
    if (!isValidDraft(draft)) continue;
    const key = normalize(draft.question);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(draft);
  }
  const order = (theme: string) => {
    const index = QUESTION_THEMES.indexOf(
      theme as (typeof QUESTION_THEMES)[number],
    );
    return index === -1 ? QUESTION_THEMES.length : index;
  };
  kept.sort((a, b) => order(a.theme) - order(b.theme));
  return kept.map((draft, index) => ({
    number: index + 1,
    category: draft.theme,
    question: draft.question,
    evidenceBasis: draft.evidenceBasis,
    label: draft.label,
    sources: draft.sources,
  }));
}

export function buildGroundedCrossExamQuestions(input: {
  expertName: string;
  evidence: ExpertEvidenceItem[];
  discrepancies?: ExpertDiscrepancy[];
}): CrossExamQuestion[] {
  return finalizeQuestions(buildQuestionDrafts(input));
}

/** A draft is kept only when it is specific, sourced and well formed. */
export function isValidDraft(draft: QuestionDraft): boolean {
  const text = draft.question.trim();
  if (text.length < 30 || text.length > 700) return false;
  if (!text.endsWith('?')) return false;
  if (GENERIC_STEMS.test(text)) return false;
  if (!draft.evidenceBasis.trim()) return false;
  if (!['verified', 'allegation', 'unresolved'].includes(draft.label))
    return false;
  return (
    draft.sources.length > 0 &&
    draft.sources.every((s) => s.name.trim().length > 0)
  );
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
    const basis = [
      `${label === 'verified' ? 'Verified' : label === 'allegation' ? 'Allegation (reported, not adjudicated)' : 'Unresolved (identity or detail not confirmed)'}.`,
      `${host}${stamp}: “${fact.quote}”`,
      web.match?.basis?.length
        ? `Tied to the expert by: ${web.match.basis.slice(0, 3).join('; ')}.`
        : '',
      item.url,
    ]
      .filter(Boolean)
      .join(' ');
    drafts.push({
      theme: themeForClaim(theme, fact.type),
      question,
      label,
      sources: [source],
      evidenceBasis: basis,
      anchors: [fact.quote.slice(0, 50), ...(date ? [date.slice(0, 4)] : [])],
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
    return `A review on ${host}${stamp}${input.rating ? ` rated ${input.rating}` : ''} said: ${q} You are aware of that review, correct?`;
  }
  if (input.type === 'allegation') {
    return `${host} reported${stamp}: ${q} You are aware of that allegation, correct?`;
  }
  if (input.kind === 'court' || input.kind === 'justia') {
    return `A court document, “${title}”${stamp}, states: ${q} You are the person it describes, correct?`;
  }
  if (input.kind === 'news' || input.kind === 'blog') {
    return `${host} wrote${stamp}: ${q} That description of you is accurate, correct?`;
  }
  if (input.kind === 'social') {
    return `On ${input.platform ?? host}${stamp} the following appears under your name: ${q} Those are your words, correct?`;
  }
  if (input.kind === 'video' || input.kind === 'presentation') {
    return `In “${title}”${stamp} on ${host}, the following was said or shown: ${q} That was you, correct?`;
  }
  if (input.basis === 'primary_source') {
    return `${host}, which records these credentials, states: ${q} That entry is accurate, correct?`;
  }
  if (input.basis === 'third_party' && input.type !== 'allegation') {
    return `${host}${stamp} states about you: ${q} That is accurate, correct?`;
  }
  if (input.type === 'advertising' || input.type === 'forensic') {
    return `${host} presents your services this way: ${q} That is how you market yourself, correct?`;
  }
  if (input.type === 'credential') {
    return `${host} states: ${q} That is how you describe your credentials, correct?`;
  }
  return `${host}${stamp} states: ${q} That is accurate, correct?`;
}

function themeForClaim(theme: string, type: string): string {
  if (type === 'advertising' || type === 'forensic')
    return 'Marketing and expert-witness business';
  if (type === 'credential') return 'Background and credentials';
  if (type === 'allegation' && theme === 'Public statements and media')
    return 'Discipline and complaints';
  return theme;
}

// ---------------------------------------------------------- registry items

function registryDrafts(item: ExpertEvidenceItem): QuestionDraft[] {
  if (item.category === 'web') return [];
  if (item.identityMatch === 'uncertain') return [];
  if (item.access === 'restricted' || item.access === 'unavailable') return [];
  if (item.informationStatus === 'unavailable') return [];
  const fact = clip(stripCaveats(item.summary), 240);
  if (fact.length < 25) return [];
  const sourceName = item.source?.name ?? item.sourceId;
  const date = isoDate(item.retrievedAt ?? item.source?.retrievedAt ?? null);
  const label: QuestionLabel =
    item.informationStatus === 'verified' ? 'verified' : 'unresolved';
  const theme = themeForCategory(item.category);
  const question =
    label === 'verified'
      ? `${sourceName} records: “${fact}” That is accurate, correct?`
      : `${sourceName} lists, without independent confirmation: “${fact}” Can you confirm or correct that?`;
  return [
    {
      theme,
      question,
      label,
      sources: [
        {
          name: sourceName,
          ...(item.url ? { url: item.url } : {}),
          ...(date ? { date } : {}),
        },
      ],
      evidenceBasis: [
        label === 'verified'
          ? 'Verified by the source.'
          : 'Unresolved: the source statement was not independently confirmed.',
        `${sourceName}${date ? ` (retrieved ${date})` : ''}: “${fact}”`,
        item.url,
      ]
        .filter(Boolean)
        .join(' '),
      anchors: [fact.slice(0, 40)],
    },
  ];
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
    .trim();
}

// ----------------------------------------------------------- discrepancies

function discrepancyDraft(
  discrepancy: ExpertDiscrepancy,
): QuestionDraft | null {
  if (
    discrepancy.label === 'verified' ||
    discrepancy.label === 'unable_to_verify'
  ) {
    return null;
  }
  const description = clip(discrepancy.description, 320);
  if (description.length < 30) return null;
  const sources: QuestionSource[] = discrepancy.sources.length
    ? discrepancy.sources.slice(0, 3).map((source) => ({
        name: source.sourceName,
        ...(source.url ? { url: source.url } : {}),
        ...(source.retrievedAt
          ? { date: isoDate(source.retrievedAt) ?? undefined }
          : {}),
      }))
    : [
        {
          name:
            discrepancy.supportingSource ??
            discrepancy.cvSource ??
            'Source comparison',
          ...(discrepancy.relatedUrls[0]
            ? { url: discrepancy.relatedUrls[0] }
            : {}),
        },
      ];
  return {
    theme: 'Inconsistencies to resolve',
    question: `${description} How do you reconcile that, doctor?`,
    label: 'unresolved',
    sources,
    evidenceBasis: `Unresolved: ${discrepancy.title}. ${description}${
      sources[0].url ? ` ${sources[0].url}` : ''
    }`,
    anchors: [description.slice(0, 40)],
  };
}

// ----------------------------------------------------------------- helpers

export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max * 0.6 ? space : max).replace(/[,;:\s]+$/, '')}…`;
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
