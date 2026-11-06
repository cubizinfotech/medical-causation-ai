import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import {
  apaNotApplicable,
  apaProgramMayApply,
} from './education-entries';
import {
  accreditationKindForUrl,
  assessmentDedupKey,
  institutionAppearsIn,
  isOfficialAccreditorUrl,
  parseAccreditationDates,
  programAppearsIn,
  statusFromHit,
} from './accreditation-match';
import type {
  AccreditationDossier,
  AccreditationSourceHit,
  AccreditationStatus,
  EducationDegreeEntry,
  ProgramAccreditationAssessment,
} from './accreditation.types';
import { ACCREDITATION_STATUS_LABEL } from './accreditation.types';

export interface AccreditationSearchHit {
  url: string;
  title?: string | null;
  snippet?: string | null;
}

export interface AccreditationFetchResult {
  url: string;
  title?: string | null;
  text: string;
  retrievedAt?: string;
}

export interface AssessAccreditationOptions {
  entries: EducationDegreeEntry[];
  specialty?: string | null;
  dossier?: WebResearchDossier | null;
  /** Optional live search (SERP). Failures become unable_to_verify. */
  search?: (query: string) => Promise<AccreditationSearchHit[]>;
  /** Optional page fetch for official hits. */
  fetchPage?: (url: string) => Promise<AccreditationFetchResult | null>;
  now?: () => Date;
}

function recordText(record: WebRecord): string {
  const claims = (record.claims ?? [])
    .map((c) => `${c.text}\n${c.quote}`)
    .join('\n');
  return `${record.title}\n${record.snippet ?? ''}\n${record.summary}\n${claims}`;
}

function hitFromMaterial(
  kind: 'apa_program' | 'institutional',
  url: string,
  title: string | null,
  text: string,
  retrievedAt: string,
): AccreditationSourceHit {
  const dates = parseAccreditationDates(text);
  return {
    kind,
    url,
    title,
    excerpt: text.replace(/\s+/g, ' ').trim().slice(0, 500),
    retrievedAt,
    accreditedFromYear: dates.fromYear,
    accreditedToYear: dates.toYear,
    currentlyListed: dates.currentlyListed && !dates.affirmativelyNotAccredited,
  };
}

function officialMaterialsFromDossier(
  dossier: WebResearchDossier | null | undefined,
): Array<{
  kind: 'apa_program' | 'institutional';
  url: string;
  title: string | null;
  text: string;
  retrievedAt: string;
}> {
  if (!dossier) return [];
  const out: Array<{
    kind: 'apa_program' | 'institutional';
    url: string;
    title: string | null;
    text: string;
    retrievedAt: string;
  }> = [];
  for (const record of dossier.records) {
    if (!isOfficialAccreditorUrl(record.url)) continue;
    const kind = accreditationKindForUrl(record.url);
    if (!kind) continue;
    out.push({
      kind,
      url: record.url,
      title: record.title || null,
      text: recordText(record),
      retrievedAt: record.retrievedAt,
    });
  }
  return out;
}

function buildQueries(entry: EducationDegreeEntry): string[] {
  const institution = entry.institution?.trim();
  if (!institution) return [];
  const program =
    entry.program ??
    entry.fieldOfStudy ??
    (entry.degreeKind === 'doctoral' ? 'psychology' : null);
  const quoted = `"${institution.replace(/"/g, '')}"`;
  const queries = [
    `site:chea.org ${quoted}`,
    `site:ope.ed.gov ${quoted}`,
  ];
  if (program) {
    queries.push(
      `site:accreditation.apa.org ${quoted} "${program.replace(/"/g, '')}"`,
      `site:apa.org/ed/accreditation ${quoted} "${program.replace(/"/g, '')}"`,
    );
  } else {
    queries.push(
      `site:accreditation.apa.org ${quoted}`,
      `site:apa.org/ed/accreditation ${quoted}`,
    );
  }
  return queries;
}

async function gatherMaterials(
  entry: EducationDegreeEntry,
  existing: ReturnType<typeof officialMaterialsFromDossier>,
  options: AssessAccreditationOptions,
): Promise<{
  materials: ReturnType<typeof officialMaterialsFromDossier>;
  queriesRun: string[];
  searchFailed: boolean;
  sourceUnavailable: boolean;
}> {
  const queriesRun = buildQueries(entry);
  const materials = [...existing];
  let searchFailed = false;
  let attemptedFetches = 0;
  let failedFetches = 0;
  if (!options.search) {
    return {
      materials,
      queriesRun,
      searchFailed,
      sourceUnavailable: false,
    };
  }
  for (const query of queriesRun) {
    let hits: AccreditationSearchHit[] = [];
    try {
      hits = await options.search(query);
    } catch {
      searchFailed = true;
      continue;
    }
    for (const hit of hits.slice(0, 3)) {
      if (!isOfficialAccreditorUrl(hit.url)) continue;
      const kind = accreditationKindForUrl(hit.url);
      if (!kind) continue;
      if (materials.some((m) => m.url === hit.url)) continue;
      let text = `${hit.title ?? ''}\n${hit.snippet ?? ''}`;
      let title = hit.title ?? null;
      let retrievedAt = (options.now?.() ?? new Date()).toISOString();
      let fetched = false;
      if (options.fetchPage) {
        attemptedFetches += 1;
        try {
          const page = await options.fetchPage(hit.url);
          if (!page) {
            failedFetches += 1;
          } else {
            text = page.text || text;
            title = page.title ?? title;
            retrievedAt = page.retrievedAt ?? retrievedAt;
            fetched = true;
          }
        } catch {
          failedFetches += 1;
        }
      }
      // Keep SERP snippet even when fetch fails so institution matching can still run.
      if (fetched || text.trim().length > 0) {
        materials.push({ kind, url: hit.url, title, text, retrievedAt });
      }
    }
  }
  const sourceUnavailable =
    attemptedFetches > 0 && failedFetches === attemptedFetches;
  return { materials, queriesRun, searchFailed, sourceUnavailable };
}

function pickBest(
  entry: EducationDegreeEntry,
  materials: ReturnType<typeof officialMaterialsFromDossier>,
  kind: 'apa_program' | 'institutional',
): {
  hit: AccreditationSourceHit | null;
  programMatched: boolean | null;
  misleadingRejected: boolean;
} {
  let misleadingRejected = false;
  let best: AccreditationSourceHit | null = null;
  let programMatched: boolean | null = null;
  for (const material of materials) {
    if (material.kind !== kind) continue;
    if (!institutionAppearsIn(entry.institution, material.text)) {
      // Similar-looking school names on the page without our institution → reject.
      if (
        entry.institution &&
        /\buniversity\b|\bcollege\b/i.test(material.text)
      ) {
        misleadingRejected = true;
      }
      continue;
    }
    const matchedProgram =
      kind === 'apa_program' ? programAppearsIn(entry, material.text) : true;
    if (kind === 'apa_program') programMatched = matchedProgram;
    if (kind === 'apa_program' && !matchedProgram) continue;
    const candidate = hitFromMaterial(
      kind,
      material.url,
      material.title,
      material.text,
      material.retrievedAt,
    );
    if (!best) {
      best = candidate;
      continue;
    }
    // Prefer pages with explicit date ranges, then currently listed.
    const score = (h: AccreditationSourceHit) =>
      (h.accreditedFromYear ? 4 : 0) +
      (h.accreditedToYear ? 2 : 0) +
      (h.currentlyListed ? 1 : 0);
    if (score(candidate) > score(best)) best = candidate;
  }
  return { hit: best, programMatched, misleadingRejected };
}

function assessOne(
  entry: EducationDegreeEntry,
  materials: ReturnType<typeof officialMaterialsFromDossier>,
  queriesRun: string[],
  specialty: string | null | undefined,
  flags: {
    searchFailed: boolean;
    sourceUnavailable: boolean;
    retrievedAt: string;
  },
): ProgramAccreditationAssessment {
  const limitations: string[] = [];
  let apaStatus: AccreditationStatus;
  let institutionalStatus: AccreditationStatus | null = null;
  let apaEvidence: AccreditationSourceHit | null = null;
  let institutionalEvidence: AccreditationSourceHit | null = null;

  if (!entry.institution && !entry.degreeName) {
    return {
      id: `acc-${entry.id}`,
      entry,
      apaStatus: 'insufficient_education_details',
      institutionalStatus: 'insufficient_education_details',
      apaEvidence: null,
      institutionalEvidence: null,
      queriesRun,
      explanation:
        'The CV education claim lacks an institution and degree detail needed for accreditation look-up.',
      limitations: ['Missing institution and degree fields on the CV claim.'],
      retrievedAt: flags.retrievedAt,
    };
  }

  if (!entry.institution) {
    return {
      id: `acc-${entry.id}`,
      entry,
      apaStatus: 'insufficient_education_details',
      institutionalStatus: 'insufficient_education_details',
      apaEvidence: null,
      institutionalEvidence: null,
      queriesRun,
      explanation:
        'The CV education claim does not name an institution, so accreditation could not be checked.',
      limitations: ['Missing institution on the CV claim.'],
      retrievedAt: flags.retrievedAt,
    };
  }

  // Institutional CHEA/USDE when institution is known.
  const institutional = pickBest(entry, materials, 'institutional');
  institutionalEvidence = institutional.hit;
  if (flags.searchFailed && !institutional.hit) {
    institutionalStatus = 'unable_to_verify';
    limitations.push('Institutional accreditation search failed.');
  } else if (institutional.hit) {
    institutionalStatus = statusFromHit(entry, institutional.hit);
  } else if (flags.sourceUnavailable) {
    institutionalStatus = 'unable_to_verify';
    limitations.push('Official institutional accreditation source was unavailable.');
  } else {
    institutionalStatus = 'unable_to_verify';
    limitations.push(
      'No matching CHEA or U.S. Department of Education listing was retrieved for this institution. That is not proof the school was unaccredited.',
    );
  }

  if (apaNotApplicable(entry, specialty)) {
    apaStatus = 'not_applicable';
    limitations.push(
      'APA CoA program accreditation applies to doctoral psychology programs; this entry is outside that scope.',
    );
  } else if (!apaProgramMayApply(entry, specialty) && !entry.program && !entry.fieldOfStudy) {
    apaStatus = 'insufficient_education_details';
    limitations.push(
      'Program or field of study was not stated clearly enough for an APA CoA match.',
    );
  } else {
    const apa = pickBest(entry, materials, 'apa_program');
    apaEvidence = apa.hit;
    if (flags.searchFailed && !apa.hit) {
      apaStatus = 'unable_to_verify';
      limitations.push('APA accreditation search failed.');
    } else if (flags.sourceUnavailable && !apa.hit) {
      apaStatus = 'unable_to_verify';
      limitations.push('APA accreditation source was unavailable or restricted.');
    } else if (
      !apa.hit &&
      (apa.programMatched === false || apa.misleadingRejected)
    ) {
      apaStatus = 'no_matching_program';
      limitations.push(
        apa.programMatched === false
          ? 'An APA listing for a different program at a similar school was not treated as a match.'
          : 'No matching APA CoA program listing was found for this institution and program.',
      );
    } else if (!apa.hit) {
      apaStatus = 'unable_to_verify';
      limitations.push(
        'No APA CoA listing was retrieved for this institution and program. A missing search result is not proof the program was unaccredited.',
      );
    } else {
      apaStatus = statusFromHit(entry, apa.hit, {
        requireProgramMatch: true,
        programMatched: apa.programMatched ?? true,
      });
      if (
        apaStatus === 'currently_accredited' &&
        entry.startYear === null &&
        entry.endYear === null &&
        entry.graduationYear === null
      ) {
        limitations.push(
          'Attendance or graduation years were not stated on the CV; historical accreditation during the expert’s attendance period could not be confirmed from dates alone.',
        );
      } else if (
        apaStatus === 'currently_accredited' &&
        apa.hit.accreditedFromYear === null &&
        apa.hit.accreditedToYear === null
      ) {
        limitations.push(
          'The official listing did not publish usable accreditation effective dates; only current listing status is reported.',
        );
      }
    }
  }

  const explanation = explain(entry, apaStatus, institutionalStatus);
  return {
    id: `acc-${entry.id}`,
    entry,
    apaStatus,
    institutionalStatus,
    apaEvidence,
    institutionalEvidence,
    queriesRun,
    explanation,
    limitations,
    retrievedAt: flags.retrievedAt,
  };
}

function explain(
  entry: EducationDegreeEntry,
  apa: AccreditationStatus,
  institutional: AccreditationStatus | null,
): string {
  const who = entry.institution ?? 'the stated institution';
  const program =
    entry.program ?? entry.fieldOfStudy ?? entry.degreeName ?? 'the program';
  const parts = [
    `APA CoA: ${ACCREDITATION_STATUS_LABEL[apa]} for ${program} at ${who}.`,
  ];
  if (institutional) {
    parts.push(
      `Institutional (CHEA/USDE): ${ACCREDITATION_STATUS_LABEL[institutional]}.`,
    );
  }
  return parts.join(' ');
}

/**
 * Assess each CV education entry against official APA CoA and CHEA/USDE
 * materials. Search/fetch failures never become “unaccredited.”
 */
export async function assessProgramAccreditation(
  options: AssessAccreditationOptions,
): Promise<AccreditationDossier> {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const existing = officialMaterialsFromDossier(options.dossier);
  const warnings: string[] = [];
  const assessments: ProgramAccreditationAssessment[] = [];
  const seen = new Set<string>();

  for (const entry of options.entries) {
    const gathered = await gatherMaterials(entry, existing, options);
    const assessment = assessOne(
      entry,
      gathered.materials,
      gathered.queriesRun,
      options.specialty,
      {
        searchFailed: gathered.searchFailed,
        sourceUnavailable: gathered.sourceUnavailable,
        retrievedAt,
      },
    );
    const key = assessmentDedupKey(
      assessment.entry,
      assessment.apaStatus,
      assessment.institutionalStatus,
    );
    if (seen.has(key)) continue;
    seen.add(key);
    assessments.push(assessment);
  }

  if (assessments.length === 0) {
    warnings.push(
      'No structured education entries were available for accreditation assessment.',
    );
  }

  return { assessedAt: retrievedAt, assessments, warnings };
}

/** Synchronous path used when only dossier materials (or fixtures) are available. */
export function assessProgramAccreditationFromMaterials(
  entries: EducationDegreeEntry[],
  materials: Array<{
    kind: 'apa_program' | 'institutional';
    url: string;
    title?: string | null;
    text: string;
    retrievedAt?: string;
  }>,
  options: {
    specialty?: string | null;
    searchFailed?: boolean;
    sourceUnavailable?: boolean;
    now?: () => Date;
  } = {},
): AccreditationDossier {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const normalized = materials.map((m) => ({
    kind: m.kind,
    url: m.url,
    title: m.title ?? null,
    text: m.text,
    retrievedAt: m.retrievedAt ?? retrievedAt,
  }));
  const assessments: ProgramAccreditationAssessment[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const assessment = assessOne(
      entry,
      normalized,
      buildQueries(entry),
      options.specialty,
      {
        searchFailed: Boolean(options.searchFailed),
        sourceUnavailable: Boolean(options.sourceUnavailable),
        retrievedAt,
      },
    );
    const key = assessmentDedupKey(
      assessment.entry,
      assessment.apaStatus,
      assessment.institutionalStatus,
    );
    if (seen.has(key)) continue;
    seen.add(key);
    assessments.push(assessment);
  }
  return {
    assessedAt: retrievedAt,
    assessments,
    warnings:
      assessments.length === 0
        ? [
            'No structured education entries were available for accreditation assessment.',
          ]
        : [],
  };
}
