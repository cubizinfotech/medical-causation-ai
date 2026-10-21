import {
  articleTitle,
  describePosition,
  sameTitle,
  stateName,
  taxonomyMatches,
  type ExpertEvidenceItem,
  type ExpertIdentityResolution,
  type ExpertResearchSourceResult,
  type PublicationLookupResult,
} from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import {
  priorityFor,
  type InconsistencyLabel,
  type VerificationField,
} from '../research/verification-labels';
import type {
  CvCheck,
  CvClaim,
  CvComparison,
  CvComparisonTopic,
  CvExtraction,
} from './cv.types';

/** Open Payments totals at or above this, missing from the CV, are flagged. */
const UNDISCLOSED_PAYMENT_USD = 1000;
const MAX_EDUCATION_ROWS = 8;

export interface CvComparisonInput {
  extraction: CvExtraction;
  evidence: ExpertEvidenceItem[];
  sourceResults: ExpertResearchSourceResult[];
  identity: ExpertIdentityResolution | null;
  publications: PublicationLookupResult[];
}

type Row = Omit<CvComparison, 'id'>;

/**
 * Sets each CV claim against what the collected sources show. Labels follow
 * the source: self-reported registry data never counts as a verification,
 * and a source that is silent is not proof the claim is false.
 */
export function compareCv(input: CvComparisonInput): CvCheck {
  const { extraction } = input;
  const claims = extraction.claims;
  const rows: Row[] = [
    ...specialtyRows(claims, input),
    ...licenseRows(claims, input),
    ...boardRows(claims),
    ...publicationCountRows(claims, input.evidence),
    ...publicationTitleRows(claims, input.publications),
    ...unreadPageRows(extraction),
    ...industryRows(claims, input),
    ...appointmentRows(claims, input.evidence),
    ...expertWitnessRows(claims, input.evidence),
    ...educationRows(claims),
  ];
  return {
    document: extraction.document,
    status: extraction.status,
    claims,
    comparisons: rows.map((row, index) => ({ id: `cvc-${index + 1}`, ...row })),
    warnings: extraction.warnings,
    ...(extraction.incompletePages?.length
      ? { incompletePages: extraction.incompletePages }
      : {}),
  };
}

const TOPIC_FIELD: Record<CvComparisonTopic, VerificationField> = {
  license: 'license',
  specialty: 'specialty',
  board_certification: 'board_certification',
  publications_count: 'publication',
  publication: 'publication',
  industry_relationship: 'corporate_affiliation',
  appointment: 'university_affiliation',
  expert_witness: 'cv',
  education: 'education',
};

/**
 * Comparisons worth raising as inconsistencies: conflicts and claims a
 * source should have shown but did not.
 */
export function cvDiscrepancies(check: CvCheck): ExpertDiscrepancy[] {
  const seen = new Set<string>();
  return check.comparisons
    .filter(
      (row) =>
        row.label === 'conflicting' ||
        (row.label === 'not_found' &&
          row.severity !== 'low' &&
          row.topic !== 'publication'),
    )
    .flatMap((row) => {
      const key = `${row.topic}:${normalizeTitle(row.cv?.statement ?? row.title)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          id: `cv-check-${row.id}`,
          severity: row.severity,
          title: row.title,
          description: [
            row.cv
              ? `CV: "${row.cv.quote ?? row.cv.statement}"${row.cv.page ? ` (page ${row.cv.page})` : ''}.`
              : '',
            row.source ? `${row.source.name}: ${row.source.statement}` : '',
            row.note,
          ]
            .filter(Boolean)
            .join(' '),
          evidenceIds: [
            row.cv?.claimId,
            row.cv?.page != null ? `cv-page-${row.cv.page}` : undefined,
            `cv-check-${row.id}`,
            row.source?.url,
            row.source?.name,
          ].filter((value): value is string => Boolean(value)),
          relatedUrls: row.source?.url ? [row.source.url] : [],
          label: row.label,
          field: TOPIC_FIELD[row.topic],
          previousValue: row.cv?.statement ?? null,
          currentValue: row.source?.statement ?? null,
          change: null,
          cvDate: null,
          cvSource: `Uploaded CV: ${check.document.name}`,
          supportingSource: row.source?.name ?? null,
          priority: priorityFor(row.severity, row.label),
          sources: [
            {
              sourceId: 'cv',
              sourceName: `Uploaded CV: ${check.document.name}`,
              title: row.cv?.statement ?? row.title,
              value: row.cv?.quote ?? row.cv?.statement ?? '',
            },
            ...(row.source
              ? [
                  {
                    sourceId: 'source',
                    sourceName: row.source.name,
                    title: row.source.statement,
                    url: row.source.url,
                    value: row.source.statement,
                  },
                ]
              : []),
          ],
        },
      ];
    });
}

/** Absence from a publication catalog is not a proven inconsistency. */
export function isCatalogAbsenceFinding(input: {
  field?: string | null;
  label?: string | null;
  title?: string | null;
}): boolean {
  if (input.field !== 'publication') return false;
  if (input.label === 'conflicting') return false;
  return /not found in (the catalogs|OpenAlex)|not confirmed in the catalogs|not confirmed by available sources|not searched in catalogs/i.test(
    input.title ?? '',
  );
}

function normalizeTitle(value: string): string {
  return articleTitle(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function cvSide(claim: CvClaim): NonNullable<CvComparison['cv']> {
  return {
    claimId: claim.id,
    statement: claim.statement,
    page: claim.page,
    quote: claim.quote,
  };
}

function byCategory(claims: CvClaim[], category: CvClaim['category']) {
  return claims.filter((claim) => claim.category === category);
}

function findItem(
  evidence: ExpertEvidenceItem[],
  sourceId: string,
  category?: string,
): ExpertEvidenceItem | undefined {
  return evidence.find(
    (item) =>
      item.sourceId === sourceId &&
      item.identityMatch !== 'uncertain' &&
      (!category || item.category === category),
  );
}

function confirmed(input: CvComparisonInput): boolean {
  return input.identity?.status === 'confirmed' && !input.identity.simulated;
}

function specialtyRows(claims: CvClaim[], input: CvComparisonInput): Row[] {
  const claim =
    byCategory(claims, 'specialty')[0] ??
    byCategory(claims, 'board_certification').find(
      (candidate) => candidate.details.specialty,
    );
  const specialty = claim?.details.specialty;
  if (!claim || !specialty) return [];
  const identity = findItem(input.evidence, 'npi_registry', 'identity');
  const taxonomies = Array.isArray(identity?.raw?.taxonomies)
    ? (identity.raw.taxonomies as Array<{ description?: unknown }>)
        .map((taxonomy) => taxonomy.description)
        .filter((value): value is string => typeof value === 'string')
    : [];
  if (!confirmed(input) || taxonomies.length === 0) {
    return [
      {
        topic: 'specialty',
        label: 'unable_to_verify',
        severity: 'low',
        title: `Specialty: ${specialty}`,
        cv: cvSide(claim),
        source: null,
        note: "The expert's NPI record was not confirmed, so the specialty was not compared.",
      },
    ];
  }
  const matches = taxonomies.some((taxonomy) =>
    taxonomyMatches(specialty, taxonomy),
  );
  return [
    {
      topic: 'specialty',
      label: matches ? 'partially_verified' : 'conflicting',
      severity: matches ? 'low' : 'high',
      title: matches
        ? `Specialty "${specialty}" fits the NPI Registry taxonomy`
        : `CV specialty "${specialty}" does not match the NPI Registry taxonomy`,
      cv: cvSide(claim),
      source: {
        name: 'NPI Registry',
        statement: `Taxonomy: ${taxonomies.join('; ')}.`,
        url: identity?.url,
      },
      note: 'Taxonomy is chosen by the clinician and is not board certification.',
    },
  ];
}

function licenseRows(claims: CvClaim[], input: CvComparisonInput): Row[] {
  const cvLicenses = byCategory(claims, 'license').filter(
    (claim) => claim.details.state,
  );
  const npiItem = findItem(input.evidence, 'npi_registry', 'license');
  const nppes = Array.isArray(npiItem?.raw?.nppesLicenses)
    ? (npiItem.raw.nppesLicenses as Array<{
        state?: unknown;
        number?: unknown;
      }>)
    : [];
  const nppesStates = new Set(
    nppes
      .map((license) => license.state)
      .filter((state): state is string => typeof state === 'string'),
  );
  if (!confirmed(input)) {
    return cvLicenses.map((claim) => ({
      topic: 'license' as const,
      label: 'unable_to_verify' as const,
      severity: 'low' as const,
      title: `License in ${stateLabel(claim.details.state)}`,
      cv: cvSide(claim),
      source: null,
      note: "The expert's NPI record was not confirmed, so licenses were not compared. Check the state medical board.",
    }));
  }
  const rows: Row[] = cvLicenses.map((claim) => {
    const listed = nppesStates.has(claim.details.state!);
    return {
      topic: 'license',
      label: listed ? 'partially_verified' : 'not_found',
      severity: listed ? 'low' : 'medium',
      title: listed
        ? `License in ${stateLabel(claim.details.state)} is listed in the NPI Registry`
        : `License in ${stateLabel(claim.details.state)} is not listed in the NPI Registry`,
      cv: cvSide(claim),
      source: {
        name: 'NPI Registry',
        statement:
          nppesStates.size > 0
            ? `Licenses reported to NPPES: ${[...nppesStates].join(', ')}.`
            : 'No license is reported to NPPES.',
        url: npiItem?.url,
      },
      note: 'Licenses in the NPI Registry are self-reported, and not every license is listed. Confirm with the state medical board.',
    };
  });
  const cvStates = new Set(cvLicenses.map((claim) => claim.details.state));
  for (const state of nppesStates) {
    if (cvStates.has(state)) continue;
    rows.push({
      topic: 'license',
      label: 'not_verified',
      severity: 'low',
      title: `NPI Registry lists a ${stateLabel(state)} license the CV does not mention`,
      cv: null,
      source: {
        name: 'NPI Registry',
        statement: `License reported to NPPES in ${stateLabel(state)}.`,
        url: npiItem?.url,
      },
      note: 'Ask why the license is not on the CV, and check that state board for its status and any discipline.',
    });
  }
  return rows;
}

function boardRows(claims: CvClaim[]): Row[] {
  return byCategory(claims, 'board_certification').map((claim) => ({
    topic: 'board_certification' as const,
    label: 'unable_to_verify' as const,
    severity: 'medium' as const,
    title: `Board certification: ${[claim.details.board, claim.details.specialty].filter(Boolean).join(', ') || claim.statement}`,
    cv: cvSide(claim),
    source: null,
    note: 'No board certification source is connected. Check certificationmatters.org (ABMS member boards) or the certifying board.',
  }));
}

function publicationCountRows(
  claims: CvClaim[],
  evidence: ExpertEvidenceItem[],
): Row[] {
  const stated = byCategory(claims, 'publications_count').filter(
    (claim) => claim.details.count !== undefined,
  );
  if (stated.length === 0) return [];
  const claim = stated.reduce((best, next) =>
    (next.details.count ?? 0) > (best.details.count ?? 0) ? next : best,
  );
  const cvCount = claim.details.count ?? 0;
  const profile = findItem(evidence, 'openalex', 'profile');
  const indexed = profile?.raw?.worksCount;
  if (typeof indexed !== 'number') {
    return [
      {
        topic: 'publications_count',
        label: 'unable_to_verify',
        severity: 'low',
        title: `CV states ${cvCount} publications`,
        cv: cvSide(claim),
        source: null,
        note: 'No OpenAlex author profile was matched to the expert, so the count was not compared.',
      },
    ];
  }
  const gap = cvCount - indexed;
  const padded = gap >= 5 && cvCount > indexed * 1.25;
  return [
    {
      topic: 'publications_count',
      label: padded ? 'conflicting' : 'partially_verified',
      severity: padded ? 'medium' : 'low',
      title: padded
        ? `CV states ${cvCount} publications; OpenAlex lists ${indexed}`
        : `CV publication count (${cvCount}) is consistent with OpenAlex (${indexed})`,
      cv: cvSide(claim),
      source: {
        name: 'OpenAlex',
        statement: `${indexed} works on the matched author profile.`,
        url: profile?.url,
      },
      note: 'OpenAlex can miss abstracts, book chapters, and journals it does not index. Ask the expert for the full list.',
    },
  ];
}

function publicationTitleRows(
  claims: CvClaim[],
  lookups: PublicationLookupResult[],
): Row[] {
  const rows: Row[] = [];
  const seen: string[] = [];
  for (const claim of byCategory(claims, 'publication')) {
    const title = claim.details.title;
    if (!title) continue;
    const identityKey =
      claim.details.doi?.toLowerCase() ?? claim.details.pmid ?? title;
    if (
      seen.some(
        (existing) => existing === identityKey || sameTitle(existing, title),
      )
    ) {
      continue;
    }
    seen.push(identityKey);
    const lookup = lookups.find((entry) => matchesLookup(entry, claim));
    const catalogs = lookup ? checkedCatalogs(lookup) : '';
    const failed = (lookup?.checks ?? []).filter(
      (check) => check.outcome === 'error',
    );
    const pubType =
      lookup?.publicationType ?? claim.details.publicationType ?? 'unverified';
    if (!lookup || lookup.status === 'unavailable') {
      rows.push({
        topic: 'publication',
        label: 'unable_to_verify',
        severity: 'low',
        title: `Publication not searched in catalogs: ${title}`,
        cv: cvSide(claim),
        source: null,
        note: [
          'The CV citation is retained. No catalog search completed for this title, so it is not disproven.',
          `Publication type: ${pubType}.`,
          failed.length > 0
            ? `Catalogs that could not be reached: ${failed.map((check) => check.catalog).join(', ')}.`
            : 'Publication catalogs were not searched.',
        ].join(' '),
      });
      continue;
    }
    const work = lookup.work;
    const place =
      lookup.authorPosition &&
      lookup.authorIndex !== undefined &&
      lookup.authorCount
        ? describePosition(
            lookup.authorPosition,
            lookup.authorIndex,
            lookup.authorCount,
          )
        : null;
    const identifiers = [
      lookup.doi ? `DOI ${lookup.doi}` : '',
      lookup.pmid ? `PMID ${lookup.pmid}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    const statement = [
      `${work?.title ?? title}${work?.year ? ` (${work.year})` : ''}.`,
      `Authors: ${work?.authors.join(', ') || 'not listed'}.`,
      `Type: ${pubType}.`,
      identifiers,
    ]
      .filter(Boolean)
      .join(' ');
    if (lookup.status === 'authored') {
      const differs = lookup.positionCheck === 'differs';
      const positionOpen =
        lookup.positionCheck === 'not_verifiable' ||
        lookup.authorListIncomplete === true;
      rows.push({
        topic: 'publication',
        label: differs ? 'conflicting' : 'verified',
        severity: differs ? 'medium' : 'low',
        title: differs
          ? `Publication found; the expert's author position differs from the CV: ${title}`
          : positionOpen
            ? `Verified match (author position not verifiable). Publication found with the expert as an author${place ? ` (${place})` : ''}: ${title}`
            : `Verified match. Publication found with the expert as an author${place ? ` (${place})` : ''}: ${title}`,
        cv: cvSide(claim),
        source: {
          name: lookup.catalog ?? 'OpenAlex',
          statement,
          url: work?.url,
        },
        note: [
          place ? `${lookup.catalog} lists the expert as ${place}.` : '',
          differs
            ? `The CV citation lists the expert as ${lookup.cvAuthorPosition}.`
            : '',
          lookup.positionCheck === 'confirmed'
            ? 'The CV position matches the catalog.'
            : '',
          positionOpen
            ? 'Author position not verifiable: the catalog author list is truncated or shorter than the CV citation. First, corresponding, or senior authorship was not inferred.'
            : '',
          `Catalogs checked: ${catalogs}.`,
        ]
          .filter(Boolean)
          .join(' '),
      });
    } else if (lookup.status === 'not_author') {
      rows.push({
        topic: 'publication',
        label: 'conflicting',
        severity: 'high',
        title: `Publication found, but at least two catalogs do not list the expert as an author: ${title}`,
        cv: cvSide(claim),
        source: {
          name: lookup.catalog ?? 'OpenAlex',
          statement,
          url: work?.url,
        },
        note: `Catalogs checked: ${catalogs}. Compare with the published article before relying on this.`,
      });
    } else if (lookup.status === 'author_unconfirmed') {
      rows.push({
        topic: 'publication',
        label: 'unable_to_verify',
        severity: 'medium',
        title: `Partial match; manual review required. Publication found; the expert's authorship could not be confirmed from the catalogs: ${title}`,
        cv: cvSide(claim),
        source: {
          name: lookup.catalog ?? 'OpenAlex',
          statement,
          url: work?.url,
        },
        note: `The author list we could read is ${lookup.authorListIncomplete ? 'incomplete or from a single catalog' : 'missing the expert'}${lookup.cvAuthorCount ? ` (the CV lists ${lookup.cvAuthorCount} authors; the catalog lists ${lookup.authorCount ?? 0})` : ''}. This is not a finding that the expert did not write it. Catalogs checked: ${catalogs}. Ask for the article or check the publisher page.`,
      });
    } else {
      const typedGap =
        pubType === 'chapter' ||
        pubType === 'abstract' ||
        pubType === 'presentation' ||
        pubType === 'poster';
      rows.push({
        topic: 'publication',
        label: 'not_verified',
        severity: 'low',
        title: `Not confirmed by available sources. Publication not confirmed in the catalogs searched: ${title}`,
        cv: cvSide(claim),
        source: {
          name: catalogs,
          statement: `No matching work in ${catalogs}. Absence from these catalogs is not proof the citation is false.`,
        },
        note: [
          `Catalogs searched: ${catalogs}.`,
          `Publication type: ${pubType}.`,
          typedGap
            ? 'This type is often not indexed as a peer-reviewed journal article.'
            : '',
          failed.length > 0
            ? `Not reached: ${failed.map((check) => check.catalog).join(', ')}.`
            : '',
          'OpenAlex, Crossref, PubMed, and ORCID do not index every journal, chapter, or abstract. Ask the expert for a copy. This is not a finding that the publication is fabricated.',
        ]
          .filter(Boolean)
          .join(' '),
      });
    }
  }
  return rows;
}

function matchesLookup(
  entry: PublicationLookupResult,
  claim: CvClaim,
): boolean {
  const title = claim.details.title ?? '';
  if (
    sameTitle(entry.title, title) ||
    sameTitle(articleTitle(entry.title), articleTitle(title))
  ) {
    return true;
  }
  if (
    claim.details.doi &&
    entry.doi &&
    claim.details.doi.toLowerCase() === entry.doi.toLowerCase()
  ) {
    return true;
  }
  return Boolean(
    claim.details.pmid && entry.pmid && claim.details.pmid === entry.pmid,
  );
}

function unreadPageRows(extraction: CvExtraction): Row[] {
  const pages = new Set<number>([
    ...extraction.document.unreadablePages,
    ...(extraction.incompletePages ?? []),
  ]);
  return [...pages]
    .sort((a, b) => a - b)
    .map((page) => {
      const noText = extraction.document.unreadablePages.includes(page);
      return {
        topic: 'publication' as const,
        label: 'unable_to_verify' as const,
        severity: 'low' as const,
        title: `CV page unread or partially extracted: page ${page}`,
        cv: {
          statement: `CV page ${page} was not fully read.`,
          page,
        },
        source: null,
        note: noText
          ? 'This page had no readable text. The original uploaded CV was not overwritten. The CV was not fully reviewed.'
          : 'The extraction model did not finish this page. Numbered publications parsed from it are retained. The CV was not fully reviewed.',
      };
    });
}

function checkedCatalogs(lookup: PublicationLookupResult): string {
  const reached = (lookup.checks ?? [])
    .filter((check) => check.outcome !== 'error')
    .map((check) => check.catalog);
  return reached.length > 0 ? reached.join(', ') : 'OpenAlex';
}

function payerKey(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|plc|lp|usa|us|na|holdings|group)\b/g,
      '',
    )
    .replace(/[^a-z0-9]/g, '');
}

function sameCompany(left: string, right: string): boolean {
  const a = payerKey(left);
  const b = payerKey(right);
  if (a.length < 3 || b.length < 3) return false;
  return a.includes(b) || b.includes(a);
}

function industryRows(claims: CvClaim[], input: CvComparisonInput): Row[] {
  const disclosed = byCategory(claims, 'industry_relationship').filter(
    (claim) => claim.details.company,
  );
  const openPayments = input.sourceResults.find(
    (result) => result.sourceId === 'open_payments',
  );
  const searched =
    openPayments?.status === 'ok' || openPayments?.status === 'no_result';
  if (!searched) {
    return disclosed.length > 0
      ? [
          {
            topic: 'industry_relationship',
            label: 'unable_to_verify',
            severity: 'low',
            title: 'Industry relationships on the CV were not compared',
            cv: cvSide(disclosed[0]),
            source: null,
            note: 'Open Payments was not searched (it needs a confirmed NPI).',
          },
        ]
      : [];
  }
  const summary = input.evidence.find(
    (item) =>
      item.sourceId === 'open_payments' &&
      item.raw?.openPaymentsSummary === true,
  );
  const payers = Array.isArray(summary?.raw?.topPayers)
    ? (
        summary.raw.topPayers as Array<{ payer?: unknown; total?: unknown }>
      ).filter(
        (row): row is { payer: string; total: number } =>
          typeof row.payer === 'string' && typeof row.total === 'number',
      )
    : [];
  const years = Array.isArray(summary?.raw?.programYears)
    ? (summary.raw.programYears as number[])
    : [];
  const span =
    years.length > 0
      ? `${years[0]}–${years[years.length - 1]}`
      : 'the years searched';
  const rows: Row[] = [];
  for (const claim of disclosed) {
    const payer = payers.find((row) =>
      sameCompany(row.payer, claim.details.company!),
    );
    rows.push(
      payer
        ? {
            topic: 'industry_relationship',
            label: 'verified',
            severity: 'low',
            title: `Disclosed relationship with ${claim.details.company} appears in Open Payments`,
            cv: cvSide(claim),
            source: {
              name: 'CMS Open Payments',
              statement: `${formatUsd(payer.total)} from ${payer.payer} in ${span}.`,
              url: summary?.url,
            },
            note: '',
          }
        : {
            topic: 'industry_relationship',
            label: 'not_verified',
            severity: 'low',
            title: `No Open Payments record from ${claim.details.company}`,
            cv: cvSide(claim),
            source: {
              name: 'CMS Open Payments',
              statement: `No general payments from this company in ${span}.`,
              url: summary?.url,
            },
            note: 'Some relationships are not reportable (for example research funds paid to an institution, or a non-US company).',
          },
    );
  }
  for (const payer of payers) {
    if (payer.total < UNDISCLOSED_PAYMENT_USD) continue;
    if (
      disclosed.some((claim) =>
        sameCompany(payer.payer, claim.details.company!),
      )
    ) {
      continue;
    }
    rows.push({
      topic: 'industry_relationship',
      label: 'not_found',
      severity: payer.total >= 10000 ? 'high' : 'medium',
      title: `Open Payments shows ${formatUsd(payer.total)} from ${payer.payer}; the CV does not mention it`,
      cv: null,
      source: {
        name: 'CMS Open Payments',
        statement: `${formatUsd(payer.total)} in general payments from ${payer.payer} in ${span}.`,
        url: summary?.url,
      },
      note: 'CVs often leave out industry payments. Ask about the relationship; a payment alone is not proof of bias.',
    });
  }
  return rows;
}

function appointmentRows(
  claims: CvClaim[],
  evidence: ExpertEvidenceItem[],
): Row[] {
  const profile = findItem(evidence, 'openalex', 'profile');
  const institutions = Array.isArray(profile?.raw?.institutions)
    ? (profile.raw.institutions as unknown[]).filter(
        (value): value is string => typeof value === 'string',
      )
    : [];
  if (institutions.length === 0) return [];
  return byCategory(claims, 'appointment')
    .filter((claim) => claim.details.institution)
    .flatMap((claim) => {
      const match = institutions.find((institution) =>
        sameCompany(institution, claim.details.institution!),
      );
      return match
        ? [
            {
              topic: 'appointment' as const,
              label: 'partially_verified' as const,
              severity: 'low' as const,
              title: `Affiliation with ${claim.details.institution} appears in OpenAlex`,
              cv: cvSide(claim),
              source: {
                name: 'OpenAlex',
                statement: `Last known institution: ${match}.`,
                url: profile?.url,
              },
              note: 'OpenAlex shows the institution on publications, not the title or dates of the position.',
            },
          ]
        : [];
    });
}

function expertWitnessRows(
  claims: CvClaim[],
  evidence: ExpertEvidenceItem[],
): Row[] {
  const statements = byCategory(claims, 'expert_witness');
  if (statements.length === 0) return [];
  const opinions = evidence.filter(
    (item) =>
      item.sourceId === 'courtlistener' && item.identityMatch !== 'uncertain',
  );
  const challenges = opinions.filter((item) => item.raw?.challenge).length;
  return statements.map((claim) => ({
    topic: 'expert_witness' as const,
    label: 'unable_to_verify' as const,
    severity: 'low' as const,
    title: `Expert witness experience: ${claim.statement}`,
    cv: cvSide(claim),
    source: {
      name: 'CourtListener',
      statement: `${opinions.length} published opinion(s) contain the expert's name with the specialty${challenges > 0 ? `; ${challenges} mention an admissibility challenge` : ''}.`,
    },
    note: 'Published opinions cover a small share of cases. Ask for the expert’s testimony list (Rule 26 in federal cases).',
  }));
}

function educationRows(claims: CvClaim[]): Row[] {
  return [...byCategory(claims, 'education'), ...byCategory(claims, 'training')]
    .slice(0, MAX_EDUCATION_ROWS)
    .map((claim) => ({
      topic: 'education' as const,
      label: 'unable_to_verify' as const,
      severity: 'low' as const,
      title: claim.statement,
      cv: cvSide(claim),
      source: null,
      note: 'No education source is connected. Check the school registrar, the residency program, or the state board profile.',
    }));
}

function stateLabel(code: string | undefined): string {
  return (code && stateName(code)) ?? code ?? 'an unnamed state';
}

function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Labels shown to attorneys. */
export const CV_LABEL_TEXT: Record<InconsistencyLabel, string> = {
  verified: 'Verified',
  partially_verified: 'Partly verified',
  conflicting: 'Conflicts',
  not_verified: 'Not verified',
  not_found: 'Not found',
  unable_to_verify: 'Not checked',
};
