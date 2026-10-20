import type { IdentitySubject, IdentityAssessment } from './identity-assess';
import { inferTopic } from './claim-topics';
import { textContainsQuote } from './page-text';
import {
  WEB_CLAIM_TOPICS,
  WEB_SOURCE_KINDS,
  type MatchLevel,
  type WebClaim,
  type WebClaimTopic,
  type WebResearchLlm,
  type WebSourceKind,
} from './web-research.types';

export interface ClassifierPage {
  id: string;
  url: string;
  title: string;
  /** Text the model may quote from (page excerpts, or a search snippet). */
  text: string;
  fullPage: boolean;
}

export interface ModelClassification {
  aboutSubject: 'yes' | 'likely' | 'unclear' | 'no';
  reason: string;
  kind: WebSourceKind | null;
  summary: string;
  published: string | null;
  linkQuote: string | null;
  linkQuoteVerified: boolean;
  claims: WebClaim[];
  rating: string | null;
}

const SYSTEM = `You check public web pages for an attorney's due-diligence file on one named person.
Rules:
- Use ONLY the page text given. Do not use outside knowledge about the person.
- Decide whether the page is about the SUBJECT, a different person with a similar name, or is unclear. A name match alone is not enough: judge by profession, place, employer and other details on the page.
- Quote exactly. Every "quote" must be copied character-for-character from the page text.
- Summaries state only what the page says. No opinions, no guesses, no legal conclusions.
- A claim is something the page says the subject did, advertised, was credentialed in, or was accused of. Mark accusations as type "allegation".
Return ONLY JSON.`;

const KIND_LIST = WEB_SOURCE_KINDS.join(', ');
const TOPIC_LIST = WEB_CLAIM_TOPICS.join(', ');

function userPrompt(subject: IdentitySubject, pages: ClassifierPage[]): string {
  const subjectLines = [
    `Name: ${subject.name.first} ${subject.name.middle.join(' ')} ${subject.name.last}`.replace(
      /\s+/g,
      ' ',
    ),
    `Profession or specialty: ${subject.specialty}`,
    subject.city ? `Location: ${subject.city}` : null,
    subject.npi ? `NPI: ${subject.npi}` : null,
    subject.context ? `Attorney note: ${subject.context.slice(0, 500)}` : null,
  ].filter(Boolean);
  const body = pages
    .map(
      (page) =>
        `### PAGE ${page.id}\nURL: ${page.url}\nTitle: ${page.title}\nText${page.fullPage ? '' : ' (search excerpt only)'}:\n${page.text}`,
    )
    .join('\n\n');
  return `SUBJECT\n${subjectLines.join('\n')}\n\n${body}\n\nReturn JSON: {"pages":[{"id":"<page id>","about_subject":"yes|likely|unclear|no","reason":"<one short sentence>","kind":"<one of: ${KIND_LIST}>","summary":"<1-2 sentences on what the page says about the subject, or empty if no>","published":"<YYYY-MM-DD or null>","link_quote":"<verbatim sentence from the page that names the subject in a role, or null>","claims":[{"type":"advertising|forensic|credential|allegation|rating|other","topic":"<one of: ${TOPIC_LIST}>","text":"<what the page says>","quote":"<verbatim>"}],"rating":"<e.g. 4.2 of 5 from 31 reviews, or null>"}]}`;
}

function parseJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

const ABOUT = new Set(['yes', 'likely', 'unclear', 'no']);
const CLAIM_TYPES = new Set([
  'advertising',
  'forensic',
  'credential',
  'allegation',
  'rating',
  'other',
]);

/** Sends pages to the model in small batches. A failed batch yields no classification. */
export async function classifyPages(
  llm: WebResearchLlm,
  subject: IdentitySubject,
  pages: ClassifierPage[],
  options: { batchSize?: number } = {},
): Promise<Map<string, ModelClassification>> {
  const results = new Map<string, ModelClassification>();
  const batchSize = options.batchSize ?? 4;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    let raw: string;
    try {
      raw = await llm({
        system: SYSTEM,
        user: userPrompt(subject, batch),
        maxTokens: 2800,
      });
    } catch {
      continue;
    }
    const parsed = parseJson(raw) as { pages?: unknown[] } | null;
    if (!parsed || !Array.isArray(parsed.pages)) continue;
    for (const entry of parsed.pages) {
      const item = entry as Record<string, unknown>;
      const page = batch.find((p) => p.id === item.id);
      if (!page) continue;
      const str = (value: unknown): string =>
        typeof value === 'string' ? value : '';
      const about = str(item.about_subject).toLowerCase();
      if (!ABOUT.has(about)) continue;
      const kind = str(item.kind);
      const linkQuote =
        typeof item.link_quote === 'string' && item.link_quote.trim()
          ? item.link_quote.trim()
          : null;
      const claims: WebClaim[] = [];
      for (const raw of Array.isArray(item.claims) ? item.claims : []) {
        const claim = raw as Record<string, unknown>;
        const text = typeof claim.text === 'string' ? claim.text.trim() : '';
        const quote = typeof claim.quote === 'string' ? claim.quote.trim() : '';
        if (!text || !quote || !textContainsQuote(page.text, quote)) continue;
        const type = CLAIM_TYPES.has(String(claim.type))
          ? (claim.type as WebClaim['type'])
          : 'other';
        const stated = typeof claim.topic === 'string' ? claim.topic : '';
        const topic = (WEB_CLAIM_TOPICS as readonly string[]).includes(stated)
          ? (stated as WebClaimTopic)
          : inferTopic(
              { type, text, quote },
              (WEB_SOURCE_KINDS as readonly string[]).includes(kind)
                ? (kind as WebSourceKind)
                : 'other',
            );
        claims.push({
          type,
          text: text.slice(0, 400),
          quote: quote.slice(0, 500),
          topic,
          from: page.fullPage ? 'page' : 'snippet',
        });
        if (claims.length >= 6) break;
      }
      results.set(page.id, {
        aboutSubject: about as ModelClassification['aboutSubject'],
        reason:
          typeof item.reason === 'string' ? item.reason.slice(0, 240) : '',
        kind: (WEB_SOURCE_KINDS as readonly string[]).includes(kind)
          ? (kind as WebSourceKind)
          : null,
        summary:
          typeof item.summary === 'string'
            ? item.summary.trim().slice(0, 600)
            : '',
        published:
          typeof item.published === 'string' &&
          /^\d{4}-\d{2}-\d{2}/.test(item.published)
            ? item.published.slice(0, 10)
            : null,
        linkQuote,
        linkQuoteVerified: Boolean(
          linkQuote && textContainsQuote(page.text, linkQuote),
        ),
        claims,
        rating:
          typeof item.rating === 'string' &&
          item.rating.trim() &&
          item.rating !== 'null'
            ? item.rating.trim().slice(0, 120)
            : null,
      });
    }
  }
  return results;
}

/**
 * Combines the rule-based assessment with the model's reading. The model can
 * lower a match freely; it can raise one step only when it quotes the page
 * linking the name to the subject's profession.
 */
export function mergeMatch(
  assessment: IdentityAssessment,
  model: ModelClassification | undefined,
  surname: string,
  specialtyTerms: readonly string[] = [],
): {
  level: MatchLevel;
  confidence: IdentityAssessment['confidence'];
  basis: string[];
  conflicts: string[];
  quote: string | null;
  quoteVerified: boolean;
  classifiedBy: 'model' | 'rules';
} {
  const basis = [...assessment.basis];
  const conflicts = [...assessment.conflicts];
  let level = assessment.level;
  let confidence = assessment.confidence;
  let quote = assessment.quote;
  let quoteVerified = Boolean(assessment.quote);

  if (!model) {
    return {
      level,
      confidence,
      basis,
      conflicts,
      quote,
      quoteVerified,
      classifiedBy: 'rules',
    };
  }

  if (model.reason) basis.push(`Reading of the page: ${model.reason}`);
  if (model.aboutSubject === 'no' && level !== 'none') {
    level = 'other_person';
    confidence = 'medium';
    conflicts.push(
      model.reason
        ? `The page appears to be about a different person: ${model.reason}`
        : 'The page appears to be about a different person with a similar name.',
    );
  } else if (model.aboutSubject === 'unclear') {
    if (level === 'strong') level = 'possible';
    confidence = 'low';
  } else if (
    (model.aboutSubject === 'yes' || model.aboutSubject === 'likely') &&
    model.linkQuoteVerified &&
    model.linkQuote &&
    model.linkQuote.toLowerCase().includes(surname.toLowerCase())
  ) {
    const quoteLower = model.linkQuote.toLowerCase();
    const namesProfession = specialtyTerms.some((term) =>
      quoteLower.includes(term),
    );
    if (level === 'weak') {
      level = 'possible';
      confidence = 'low';
    } else if (
      level === 'possible' &&
      model.aboutSubject === 'yes' &&
      namesProfession &&
      conflicts.length === 0 &&
      assessment.confidence !== 'low'
    ) {
      // The page itself, in one quoted sentence, ties the name to the profession.
      level = 'strong';
      confidence = 'high';
      basis.push(
        'The page states the person’s profession in the same sentence as the name.',
      );
    }
    quote = model.linkQuote;
    quoteVerified = true;
  }
  return {
    level,
    confidence,
    basis,
    conflicts,
    quote,
    quoteVerified,
    classifiedBy: 'model',
  };
}
