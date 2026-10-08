import type { EvidenceType, PubMedSummary } from './medical-literature.types';

/**
 * PubMed publication types that are never shown as supporting literature.
 * Retracted papers and notices must not reach an attorney's report.
 */
const EXCLUDED_PUBLICATION_TYPES = new Set([
  'Retracted Publication',
  'Retraction of Publication',
  'Expression of Concern',
  'Published Erratum',
  'Letter',
  'Comment',
  'Editorial',
  'News',
  'Preprint',
]);

const EVIDENCE_RULES: Array<[EvidenceType, RegExp]> = [
  ['meta_analysis', /^Meta-Analysis$/],
  ['systematic_review', /^Systematic Review$/],
  ['guideline', /Guideline$/],
  ['randomized_trial', /^Randomized Controlled Trial/],
  [
    'observational',
    /^(Observational Study|Multicenter Study|Comparative Study|Clinical Trial|Twin Study|Validation Study)/,
  ],
  ['review', /^Review$/],
  ['case_report', /^Case Reports$/],
];

/** Strongest design wins, e.g. a meta-analysis tagged "Review" too. */
export function classifyEvidence(publicationTypes: string[]): EvidenceType {
  for (const [type, pattern] of EVIDENCE_RULES) {
    if (publicationTypes.some((pubType) => pattern.test(pubType))) {
      return type;
    }
  }
  return 'other';
}

/** PubMed often tags studies only "Journal Article"; titles name the design. */
const TITLE_DESIGNS: Array<[EvidenceType, RegExp]> = [
  ['meta_analysis', /\bmeta-?analys[ie]s\b/i],
  ['systematic_review', /\bsystematic review\b/i],
  ['randomized_trial', /\brandomi[sz]ed\b.*\btrial\b/i],
  [
    'observational',
    /\b(cohort|case-control|cross-sectional|population-based|nationwide|registry)\b/i,
  ],
];

export function classifyArticle(
  publicationTypes: string[],
  title: string,
): EvidenceType {
  const byType = classifyEvidence(publicationTypes);
  if (byType !== 'other' && byType !== 'review') return byType;
  return (
    TITLE_DESIGNS.find(([, pattern]) => pattern.test(title))?.[0] ?? byType
  );
}

// For a causation question, "risk after X" studies matter more than
// "treatment of X and Y" studies that happen to name both conditions.
const CAUSATION_CUES =
  /\b(risk|associat\w*|incidence|after|following|cohort|odds|hazard|predict\w*|caus\w*|link\w*|develop\w*|sequelae|consequences?)\b/;
const TREATMENT_CUES =
  /\b(treatment|therap\w*|efficacy|management|rehabilitation|photobiomodulation|neuroprotect\w*|drugs?|interventions?|targeting|reduces|improved?|surgery|surgical)\b/;

const EVIDENCE_BONUS: Record<EvidenceType, number> = {
  meta_analysis: 0.06,
  systematic_review: 0.06,
  guideline: 0.05,
  randomized_trial: 0.05,
  observational: 0.04,
  review: 0.02,
  case_report: -0.03,
  other: 0,
};

export function isUsableSummary(summary: PubMedSummary): boolean {
  if (!summary.title?.trim()) return false;
  if ((summary.pubtype ?? []).some((t) => EXCLUDED_PUBLICATION_TYPES.has(t))) {
    return false;
  }
  if (summary.attributes && !summary.attributes.includes('Has Abstract')) {
    return false;
  }
  return !summary.lang?.length || summary.lang.includes('eng');
}

function mentions(title: string, term: string): boolean {
  const normalizedTerm = term.toLowerCase().trim();
  if (!normalizedTerm) return false;
  if (title.includes(normalizedTerm)) return true;
  // Long terms may drop one word: "motor vehicle" for "motor vehicle collision".
  const words = normalizedTerm.split(/\s+/).filter((word) => word.length > 3);
  const found = words.filter((word) => title.includes(word)).length;
  return words.length > 1 && found >= Math.max(2, words.length - 1);
}

/**
 * "Risk of motor vehicle collision after stroke" names the same things as
 * "stroke after a collision" but studies the opposite direction.
 */
export function isReversedDirection(
  title: string,
  exposureTerms: string[],
  outcomeTerms: string[],
): boolean {
  const pivot = /\b(after|following)\b/.exec(title);
  if (!pivot) return false;
  const before = title.slice(0, pivot.index);
  const after = title.slice(pivot.index);
  return (
    exposureTerms.some((t) => mentions(before, t)) &&
    outcomeTerms.some((t) => mentions(after, t)) &&
    !outcomeTerms.some((t) => mentions(before, t))
  );
}

/**
 * Merges ranked PubMed result lists and reranks them.
 * - Reciprocal-rank fusion across queries keeps PubMed's Best Match order.
 * - Titles naming both the injury and the claimed condition rank first.
 * - Stronger study designs get a small boost.
 */
export function rankCandidates(params: {
  rankedLists: Array<{ query: string; ids: string[] }>;
  summaries: Map<string, PubMedSummary>;
  exposureTerms: string[];
  outcomeTerms: string[];
}): Array<{ pmid: string; score: number; matchedQueries: string[] }> {
  const fused = new Map<string, { rrf: number; queries: string[] }>();
  for (const list of params.rankedLists) {
    list.ids.forEach((pmid, rank) => {
      const entry = fused.get(pmid) ?? { rrf: 0, queries: [] };
      entry.rrf += 1 / (10 + rank);
      entry.queries.push(list.query);
      fused.set(pmid, entry);
    });
  }

  const ranked: Array<{
    pmid: string;
    score: number;
    matchedQueries: string[];
    outcomeHit: boolean;
  }> = [];
  for (const [pmid, entry] of fused) {
    const summary = params.summaries.get(pmid);
    if (!summary || !isUsableSummary(summary)) continue;

    const title = summary.title.toLowerCase();
    const exposureHit = params.exposureTerms.some((t) => mentions(title, t));
    const outcomeHit = params.outcomeTerms.some((t) => mentions(title, t));
    const topicBonus =
      exposureHit && outcomeHit ? 0.15 : exposureHit || outcomeHit ? 0.05 : 0;
    const evidenceBonus =
      EVIDENCE_BONUS[classifyArticle(summary.pubtype ?? [], summary.title)];
    const focusBonus =
      (CAUSATION_CUES.test(title) ? 0.05 : 0) -
      (TREATMENT_CUES.test(title) ? 0.08 : 0) -
      (isReversedDirection(title, params.exposureTerms, params.outcomeTerms)
        ? 0.25
        : 0);

    ranked.push({
      pmid,
      score: entry.rrf + topicBonus + evidenceBonus + focusBonus,
      matchedQueries: entry.queries,
      outcomeHit,
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  // Fewer on-topic studies beat a list padded with papers that never mention
  // the claimed condition (e.g. TBI treatment trials in a TBI-stroke case).
  const onTopic = ranked.filter((item) => item.outcomeHit);
  const focused = onTopic.length >= MIN_ON_TOPIC ? onTopic : ranked;
  return focused.map(({ pmid, score, matchedQueries }) => ({
    pmid,
    score,
    matchedQueries,
  }));
}

const MIN_ON_TOPIC = 3;

const HTML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(lt|gt|amp|quot|#39|apos|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function clipAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const lastStop = clipped.lastIndexOf('. ');
  return lastStop > maxLength * 0.5
    ? clipped.slice(0, lastStop + 1)
    : `${clipped.trimEnd()}…`;
}

/**
 * The conclusion is the most useful part of an abstract for causation work,
 * so prefer it; otherwise use the opening sentences.
 */
export function extractAbstractExcerpt(
  abstractHtml: string,
  maxLength = 420,
): string | undefined {
  const headed =
    /(?:<h\d[^>]*>|<b>|<strong>)\s*(conclusions?|interpretation)\s*:?\s*(?:<\/h\d>|<\/b>|<\/strong>)([\s\S]*?)(?=<h\d|$)/i.exec(
      abstractHtml,
    );
  if (headed?.[2]) {
    const text = toPlainText(headed[2]);
    if (text) return clipAtSentence(text, maxLength);
  }

  const plain = toPlainText(abstractHtml);
  if (!plain) return undefined;
  const inline = /\b(?:conclusions?|interpretation)\s*:\s*/i.exec(plain);
  const fromConclusion = inline
    ? plain.slice(inline.index + inline[0].length)
    : plain;
  return clipAtSentence(fromConclusion, maxLength);
}

export function parsePublicationYear(pubdate?: string): number | undefined {
  const match = /\b(19|20)\d{2}\b/.exec(pubdate ?? '');
  return match ? Number(match[0]) : undefined;
}
