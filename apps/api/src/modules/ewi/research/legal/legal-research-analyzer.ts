import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertResearchSourceResult } from '@integrations/expert-research';
import { normalizeLegalMatters } from './legal-matter-normalizer';
import type {
  ChallengeRecord,
  ChronologicalFiling,
  DepositionRecord,
  LegalMatter,
  LegalResearchDossier,
  LegalSourceAttempt,
  OrderSignificanceTag,
  PrioritizedOrder,
  TestimonyContradiction,
} from './legal-matter.types';

const TAG_WEIGHT: Record<OrderSignificanceTag, number> = {
  strikes_expert: 100,
  limits_expert: 90,
  sanctions: 85,
  restricts_testimony: 80,
  criticizes_expert: 70,
  credibility: 65,
  qualifications: 60,
  material_effect: 50,
};

/**
 * Builds the legal research dossier from collected evidence and source attempts.
 * Does not invent court findings. Unavailable sources stay unavailable.
 */
export function buildLegalResearchDossier(input: {
  evidence: ExpertEvidenceItem[];
  sourceResults?: ExpertResearchSourceResult[];
  legalProviderIds?: readonly string[];
}): LegalResearchDossier {
  const matters = normalizeLegalMatters(input.evidence).filter(
    (matter) => matter.identityMatch !== 'uncertain',
  );
  const orders = prioritizeOrders(
    matters.filter((matter) => matter.documentType === 'order'),
  );
  const motionsAndPleadings = chronologicalFilings(
    matters.filter(
      (matter) =>
        matter.documentType === 'motion' || matter.documentType === 'pleading',
    ),
  );
  const depositions = buildDepositions(
    matters.filter((matter) => matter.documentType === 'deposition'),
  );
  const testimonyContradictions = findTestimonyContradictions(matters);
  attachDepositionContradictions(depositions, testimonyContradictions);

  return {
    matters,
    orders,
    motionsAndPleadings,
    depositions,
    testimonyContradictions,
    challenges: challengeRecords(matters),
    sourceAttempts: sourceAttemptsFor(
      input.sourceResults ?? [],
      input.legalProviderIds,
    ),
  };
}

const OUTCOME_RANK: Record<ChallengeRecord['challenge']['outcome'], number> = {
  excluded: 0,
  limited: 1,
  admitted: 2,
  not_determined: 3,
  not_challenged: 4,
};

export function challengeRecords(matters: LegalMatter[]): ChallengeRecord[] {
  return matters
    .filter(
      (
        matter,
      ): matter is LegalMatter & {
        challenge: NonNullable<LegalMatter['challenge']>;
      } => matter.challenge !== null,
    )
    .map((matter) => ({
      matter,
      challenge: matter.challenge,
      sortDate: matter.documentDate ?? matter.filingDate,
    }))
    .sort(
      (left, right) =>
        OUTCOME_RANK[left.challenge.outcome] -
          OUTCOME_RANK[right.challenge.outcome] ||
        compareDatesAsc(right.sortDate, left.sortDate),
    );
}

export function prioritizeOrders(orders: LegalMatter[]): PrioritizedOrder[] {
  return orders
    .map((matter) => {
      const significanceTags = matter.orderTags;
      const significanceScore = significanceTags.reduce(
        (sum, tag) => sum + (TAG_WEIGHT[tag] ?? 0),
        0,
      );
      return {
        matter,
        significanceScore,
        significanceTags,
        sortDate: matter.documentDate ?? matter.filingDate,
      };
    })
    .sort((left, right) => {
      if (right.significanceScore !== left.significanceScore) {
        return right.significanceScore - left.significanceScore;
      }
      return compareDatesAsc(left.sortDate, right.sortDate);
    });
}

export function chronologicalFilings(
  filings: LegalMatter[],
): ChronologicalFiling[] {
  return filings
    .map((matter) => ({
      matter,
      sortDate: matter.filingDate ?? matter.documentDate,
      description: matter.shortDescription ?? matter.summary ?? matter.title,
    }))
    .sort((left, right) => compareDatesAsc(left.sortDate, right.sortDate));
}

export function buildDepositions(matters: LegalMatter[]): DepositionRecord[] {
  return matters
    .map((matter) => ({
      matter,
      caseName: matter.caseName,
      date: matter.documentDate ?? matter.filingDate,
      sourceLink: matter.sourceUrl,
      transcriptMetadata: matter.transcriptMetadata,
      summary: matter.summary,
      importantStatements: matter.importantStatements,
      contradictions: [] as string[],
    }))
    .sort((left, right) => compareDatesAsc(left.date, right.date));
}

/**
 * Compares collected statements only when two sources both state a value
 * for the same topic and those values disagree. Silent or missing sources
 * are not treated as contradictions.
 */
export function findTestimonyContradictions(
  matters: LegalMatter[],
): TestimonyContradiction[] {
  const statements = matters.flatMap((matter) => {
    if (
      matter.documentType !== 'deposition' &&
      matter.documentType !== 'testimony'
    ) {
      return [];
    }
    return matter.importantStatements.map((statement, index) => ({
      matter,
      statement,
      topic: topicKey(statement),
      index,
    }));
  });

  const contradictions: TestimonyContradiction[] = [];
  for (let i = 0; i < statements.length; i++) {
    for (let j = i + 1; j < statements.length; j++) {
      const left = statements[i];
      const right = statements[j];
      if (left.matter.id === right.matter.id) continue;
      if (left.topic !== right.topic) continue;
      if (normalizeText(left.statement) === normalizeText(right.statement)) {
        continue;
      }
      if (!valuesDisagree(left.statement, right.statement)) continue;

      contradictions.push({
        id: `testimony-conflict-${contradictions.length + 1}`,
        statementA: left.statement,
        statementB: right.statement,
        sourceA: left.matter.evidenceReference,
        sourceB: right.matter.evidenceReference,
        evidenceReferences: [
          left.matter.evidenceReference,
          right.matter.evidenceReference,
        ],
        relatedUrls: [left.matter.sourceUrl, right.matter.sourceUrl].filter(
          (url): url is string => Boolean(url),
        ),
        description: `Collected statements disagree on ${left.topic}. "${left.statement}" (${left.matter.evidenceReference}) and "${right.statement}" (${right.matter.evidenceReference}). The comparison keeps both statements. It does not decide which is correct.`,
      });
    }
  }
  return contradictions;
}

function attachDepositionContradictions(
  depositions: DepositionRecord[],
  contradictions: TestimonyContradiction[],
): void {
  for (const deposition of depositions) {
    deposition.contradictions = contradictions
      .filter((entry) =>
        entry.evidenceReferences.includes(deposition.matter.evidenceReference),
      )
      .map((entry) => entry.description);
  }
}

function sourceAttemptsFor(
  results: ExpertResearchSourceResult[],
  legalProviderIds?: readonly string[],
): LegalSourceAttempt[] {
  const allowed = legalProviderIds ? new Set(legalProviderIds) : null;
  return results
    .filter((result) => (allowed ? allowed.has(result.sourceId) : true))
    .map((result) => ({
      sourceId: result.sourceId,
      status: result.status,
      outcome: result.outcome,
      access: result.access,
      message: result.message,
      itemCount: result.items.length,
    }));
}

function topicKey(statement: string): string {
  const lower = statement.toLowerCase();
  const match = lower.match(
    /\b(date of (?:injury|accident|exam(?:ination)?|surgery)|years? of experience|board[- ]?certif(?:ied|ication)|license|specialty|reviewed (?:the )?(?:records?|films?)|examined the (?:patient|claimant)|number of (?:imes?|exams?)|compensation|fee|hourly rate|prior testimony)\b/,
  );
  if (match) return match[1].replace(/\s+/g, ' ');
  const words = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 4);
  return words.join(' ') || lower.slice(0, 40);
}

function valuesDisagree(left: string, right: string): boolean {
  const leftNumbers = numbersIn(left);
  const rightNumbers = numbersIn(right);
  if (leftNumbers.length > 0 && rightNumbers.length > 0) {
    return leftNumbers.join('|') !== rightNumbers.join('|');
  }
  const leftNeg = /\b(did not|never|no|not|denied)\b/i.test(left);
  const rightNeg = /\b(did not|never|no|not|denied)\b/i.test(right);
  if (leftNeg !== rightNeg) return true;
  return normalizeText(left) !== normalizeText(right);
}

function numbersIn(value: string): string[] {
  return value.match(/\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\b/g) ?? [];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareDatesAsc(left: string | null, right: string | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}
