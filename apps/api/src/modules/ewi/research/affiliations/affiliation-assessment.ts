import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import { canonicalUrl } from '@integrations/web-research';
import type {
  AffiliationAssessment,
  AffiliationDossier,
  AffiliationEntry,
  AffiliationSourceHit,
  AffiliationVerificationStatus,
} from './affiliation.types';
import { AFFILIATION_STATUS_LABEL, RELATIONSHIP_TYPE_LABEL } from './affiliation.types';

export interface AffiliationSearchHit {
  url: string;
  title?: string | null;
  snippet?: string | null;
}

export interface AffiliationFetchResult {
  url: string;
  title?: string | null;
  text: string;
  retrievedAt?: string;
  restricted?: boolean;
  loginRequired?: boolean;
}

export interface AssessInstitutionalAffiliationsOptions {
  entries: AffiliationEntry[];
  expertName: string;
  specialty?: string | null;
  city?: string | null;
  dossier?: WebResearchDossier | null;
  /** Optional SERP scoped by caller; assessment still filters to mapped institution. */
  search?: (query: string) => Promise<AffiliationSearchHit[]>;
  fetchPage?: (url: string) => Promise<AffiliationFetchResult | null>;
  now?: () => Date;
  /** Hosts treated as the expert’s own site (self-reported only). */
  ownSiteHosts?: string[];
}

/** Hosts that never verify appointments (publishers / scholarly indexes). */
const NON_APPOINTMENT_HOSTS =
  /\b(openalex\.org|orcid\.org|pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov|doi\.org|crossref\.org|semanticscholar\.org|researchgate\.net|academia\.edu|scholar\.google|wiley\.com|elsevier\.com|springer\.com|nature\.com|tandfonline\.com|sagepub\.com|wolterskluwer\.com|ieee\.org)\b/i;

const TRAINING_DOC =
  /\b(practicum|internship|externship|training site|clinical training|brochure|placement site|supervisor handbook)\b/i;

const DIRECTORY_CUE =
  /\b(faculty|staff directory|people|directory|profile|biography|bio\b|department of|our team)\b/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function recordText(record: WebRecord): string {
  const claims = (record.claims ?? [])
    .map((c) => `${c.text}\n${c.quote}`)
    .join('\n');
  return `${record.title}\n${record.snippet ?? ''}\n${record.summary}\n${claims}`;
}

function nameTokens(expertName: string): string[] {
  return expertName
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !['dr', 'phd', 'psyd', 'md'].includes(t));
}

function nameAppears(expertName: string, text: string): boolean {
  const hay = text.toLowerCase();
  const tokens = nameTokens(expertName);
  if (tokens.length === 0) return false;
  const last = tokens[tokens.length - 1];
  const first = tokens[0];
  if (!hay.includes(last)) return false;
  if (tokens.length === 1) return true;
  return (
    hay.includes(first) ||
    hay.includes(`${first[0]}. ${last}`) ||
    hay.includes(`${last}, ${first[0]}.`) ||
    hay.includes(`${last}, ${first}`)
  );
}

function similarNameMismatch(expertName: string, text: string): boolean {
  const tokens = nameTokens(expertName);
  if (tokens.length < 2) return false;
  const last = tokens[tokens.length - 1];
  const first = tokens[0];
  const hay = text.toLowerCase();
  if (!hay.includes(last)) return false;
  if (hay.includes(first) || hay.includes(`${first[0]}.`)) return false;
  const nearSurname = new RegExp(
    `\\b([a-z]{2,})\\s+${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'i',
  );
  const match = hay.match(nearSurname);
  if (!match) return false;
  const other = match[1].toLowerCase();
  if (
    ['dr', 'phd', 'psyd', 'md', 'do', 'esq', 'mr', 'mrs', 'ms'].includes(other)
  ) {
    return false;
  }
  return other !== first;
}

function specialtyAppears(
  specialty: string | null | undefined,
  text: string,
): boolean {
  if (!specialty?.trim()) return false;
  const hay = text.toLowerCase();
  const tokens = specialty
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 5);
  return tokens.some((t) => hay.includes(t));
}

function placeAppears(city: string | null | undefined, text: string): boolean {
  if (!city?.trim()) return false;
  const hay = text.toLowerCase();
  const parts = city
    .split(/[,/]/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length >= 2);
  return parts.some((p) => hay.includes(p));
}

function assessIdentity(
  expertName: string,
  specialty: string | null | undefined,
  city: string | null | undefined,
  text: string,
): AffiliationSourceHit['identityLevel'] {
  if (similarNameMismatch(expertName, text)) return 'none';
  if (!nameAppears(expertName, text)) return 'none';
  if (specialtyAppears(specialty, text) || placeAppears(city, text)) {
    return 'strong';
  }
  if (text.replace(/\s+/g, ' ').trim().length < 80) return 'possible';
  return 'possible';
}

/** Significant tokens from an institution name for host/title matching. */
export function institutionTokens(institution: string): string[] {
  const stop = new Set([
    'the',
    'of',
    'and',
    'at',
    'for',
    'in',
    'university',
    'college',
    'institute',
    'school',
    'hospital',
    'medical',
    'center',
    'health',
    'system',
    'clinic',
  ]);
  return institution
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stop.has(t));
}

function institutionAcronym(institution: string): string | null {
  const words = institution
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(of|the|and|at|for|in)$/i.test(w));
  if (words.length < 2) return null;
  const acr = words.map((w) => w[0]!.toLowerCase()).join('');
  return acr.length >= 2 ? acr : null;
}

function institutionAppears(institution: string, text: string): boolean {
  const hay = text.toLowerCase();
  const compact = institution.toLowerCase().replace(/\s+/g, ' ').trim();
  if (compact.length >= 6 && hay.includes(compact)) return true;
  const acronym = institutionAcronym(institution);
  if (acronym && acronym.length >= 3 && new RegExp(`\\b${acronym}\\b`, 'i').test(hay)) {
    return true;
  }
  // Host fragment (e.g. nova.edu for Nova Southeastern University).
  const tokens = institutionTokens(institution);
  if (tokens.some((t) => t.length >= 4 && hay.includes(t))) {
    if (tokens.length <= 1) return true;
    const hits = tokens.filter((t) => hay.includes(t));
    if (hits.length >= Math.min(2, tokens.length)) return true;
    // Single distinctive token on a matching host is enough (usf.edu + "USF").
    if (hits.some((t) => t.length >= 4) && /\.(edu|org|gov)\b/i.test(hay)) {
      return true;
    }
  }
  if (tokens.length === 0) {
    const raw = institution
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4);
    return raw.length > 0 && raw.every((t) => hay.includes(t));
  }
  const hits = tokens.filter((t) => hay.includes(t));
  return hits.length >= Math.min(2, tokens.length) || hits.length === tokens.length;
}

function isPublisherOrIndexHost(url: string): boolean {
  return NON_APPOINTMENT_HOSTS.test(hostOf(url));
}

function isOwnSiteUrl(url: string, ownHosts: string[] | undefined): boolean {
  if (!ownHosts?.length) return false;
  const host = hostOf(url);
  return ownHosts.some(
    (h) => host === h.replace(/^www\./, '').toLowerCase() || host.endsWith(`.${h}`),
  );
}

function belongsToInstitution(
  url: string,
  title: string | null | undefined,
  text: string,
  institution: string,
): boolean {
  if (isPublisherOrIndexHost(url)) return false;
  const hay = `${hostOf(url)} ${title ?? ''} ${text}`.toLowerCase();
  return institutionAppears(institution, hay);
}

function isTrainingDocument(
  url: string,
  title: string | null | undefined,
  text: string,
): boolean {
  return TRAINING_DOC.test(`${url} ${title ?? ''} ${text}`);
}

function buildQueries(
  entry: AffiliationEntry,
  expertName: string,
): string[] {
  if (!entry.institution?.trim()) return [];
  const quoted = `"${expertName.replace(/"/g, '')}"`;
  const inst = `"${entry.institution.replace(/"/g, '').slice(0, 80)}"`;
  const queries: string[] = [];
  if (entry.class === 'training') {
    queries.push(
      `${quoted} ${inst} (practicum OR internship OR residency OR fellowship OR "clinical training" OR externship)`,
    );
    queries.push(`${inst} (practicum OR internship OR "training site") brochure`);
  } else {
    queries.push(
      `${quoted} ${inst} (faculty OR "staff directory" OR professor OR appointment OR attending)`,
    );
    queries.push(
      `${inst} (faculty OR directory OR staff) ${quoted}`,
    );
  }
  return queries.slice(0, 3);
}

type Material = {
  url: string;
  title: string | null;
  text: string;
  retrievedAt: string;
  restricted: boolean;
  searchResultOnly: boolean;
  trainingDocument: boolean;
  ownSite: boolean;
};

function materialsFromDossier(
  dossier: WebResearchDossier | null | undefined,
  entry: AffiliationEntry,
  ownHosts: string[] | undefined,
): Material[] {
  if (!dossier || !entry.institution) return [];
  const out: Material[] = [];
  const seen = new Set<string>();
  for (const record of dossier.records) {
    const text = recordText(record);
    if (
      !belongsToInstitution(
        record.url,
        record.title,
        text,
        entry.institution,
      )
    ) {
      continue;
    }
    const key = canonicalUrl(record.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: record.url,
      title: record.title || null,
      text,
      retrievedAt: record.retrievedAt,
      restricted:
        record.read === 'restricted' ||
        /captcha|login|sign in|subscription/i.test(record.readNote ?? ''),
      searchResultOnly: record.read !== 'read',
      trainingDocument: isTrainingDocument(record.url, record.title, text),
      ownSite: isOwnSiteUrl(record.url, ownHosts),
    });
  }
  for (const blocked of dossier.pagesBlocked ?? []) {
    if (
      !belongsToInstitution(
        blocked.url,
        null,
        blocked.reason ?? '',
        entry.institution,
      )
    ) {
      continue;
    }
    const key = canonicalUrl(blocked.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: blocked.url,
      title: null,
      text: blocked.reason || 'Blocked or login-gated page.',
      retrievedAt: dossier.ranAt ?? new Date().toISOString(),
      restricted: true,
      searchResultOnly: true,
      trainingDocument: isTrainingDocument(blocked.url, null, blocked.reason ?? ''),
      ownSite: isOwnSiteUrl(blocked.url, ownHosts),
    });
  }
  return out;
}

async function gatherMaterials(
  entry: AffiliationEntry,
  options: AssessInstitutionalAffiliationsOptions,
): Promise<{
  materials: Material[];
  queriesRun: string[];
  searchFailed: boolean;
  searchAttempted: boolean;
  allFetchesFailed: boolean;
  loginBlocked: boolean;
}> {
  const queriesRun = buildQueries(entry, options.expertName);
  const materials = materialsFromDossier(
    options.dossier,
    entry,
    options.ownSiteHosts,
  );
  const seen = new Set(materials.map((m) => canonicalUrl(m.url)));
  let searchFailed = false;
  let searchAttempted = false;
  let attemptedFetches = 0;
  let failedFetches = 0;
  let loginBlocked = false;

  if (!entry.institution || !options.search) {
    return {
      materials,
      queriesRun,
      searchFailed,
      searchAttempted: false,
      allFetchesFailed: false,
      loginBlocked,
    };
  }

  for (const query of queriesRun) {
    searchAttempted = true;
    let hits: AffiliationSearchHit[] = [];
    try {
      hits = await options.search(query);
    } catch {
      searchFailed = true;
      continue;
    }
    for (const hit of hits.slice(0, 6)) {
      if (isPublisherOrIndexHost(hit.url)) continue;
      const snippetText = `${hit.title ?? ''}\n${hit.snippet ?? ''}`;
      // Institution-scoped query: allow thin snippets through to fetch, then
      // re-check the full page against the named institution.
      const snippetMatch = belongsToInstitution(
        hit.url,
        hit.title,
        snippetText,
        entry.institution,
      );
      const key = canonicalUrl(hit.url);
      if (seen.has(key)) continue;
      let text = snippetText;
      let title = hit.title ?? null;
      let retrievedAt = (options.now?.() ?? new Date()).toISOString();
      let restricted = false;
      let searchResultOnly = true;
      let fetched = false;
      if (options.fetchPage) {
        attemptedFetches += 1;
        try {
          const page = await options.fetchPage(hit.url);
          fetched = true;
          if (!page) {
            failedFetches += 1;
          } else if (page.restricted || page.loginRequired) {
            loginBlocked = true;
            restricted = true;
            text = page.text || text;
            title = page.title ?? title;
            retrievedAt = page.retrievedAt ?? retrievedAt;
          } else {
            text = page.text || text;
            title = page.title ?? title;
            retrievedAt = page.retrievedAt ?? retrievedAt;
            searchResultOnly = false;
          }
        } catch {
          failedFetches += 1;
        }
      } else if (!snippetMatch) {
        continue;
      }
      if (
        fetched &&
        !restricted &&
        !belongsToInstitution(hit.url, title, text, entry.institution)
      ) {
        continue;
      }
      if (!fetched && !snippetMatch) continue;
      // Login-gated institutional pages still count for unable_to_access.
      if (
        restricted &&
        !belongsToInstitution(hit.url, title, `${title}\n${text}`, entry.institution) &&
        !snippetMatch
      ) {
        // Keep when the URL host itself suggests the institution.
        if (!institutionAppears(entry.institution, hostOf(hit.url))) {
          continue;
        }
      }
      seen.add(key);
      if (text.trim().length > 0 || restricted) {
        materials.push({
          url: hit.url,
          title,
          text,
          retrievedAt,
          restricted,
          searchResultOnly,
          trainingDocument: isTrainingDocument(hit.url, title, text),
          ownSite: isOwnSiteUrl(hit.url, options.ownSiteHosts),
        });
      }
    }
  }

  return {
    materials,
    queriesRun,
    searchFailed,
    searchAttempted,
    allFetchesFailed: attemptedFetches > 0 && failedFetches === attemptedFetches,
    loginBlocked,
  };
}

function pickBestHit(
  materials: Material[],
  entry: AffiliationEntry,
  expertName: string,
  specialty: string | null | undefined,
  city: string | null | undefined,
): {
  hit: AffiliationSourceHit | null;
  restrictedOnly: boolean;
  mismatchSeen: boolean;
  ownSiteOnly: boolean;
} {
  const independent = materials.filter((m) => !m.ownSite);
  const pool = independent.length > 0 ? independent : materials;
  let best: AffiliationSourceHit | null = null;
  let restrictedOnly = pool.length > 0 && pool.every((m) => m.restricted);
  let mismatchSeen = false;

  for (const material of pool) {
    if (similarNameMismatch(expertName, material.text)) {
      mismatchSeen = true;
      continue;
    }
    if (material.restricted) continue;

    // Appointments: reject training brochures and publisher hosts as proof.
    if (
      entry.class === 'appointment' &&
      (material.trainingDocument || isPublisherOrIndexHost(material.url))
    ) {
      continue;
    }

    const identityLevel = assessIdentity(
      expertName,
      specialty,
      city,
      material.text,
    );
    if (identityLevel === 'none') {
      // Training confirmations may use institutional brochure without the name.
      if (
        entry.class === 'training' &&
        material.trainingDocument &&
        institutionAppears(entry.institution ?? '', material.text)
      ) {
        const candidate: AffiliationSourceHit = {
          url: material.url,
          title: material.title,
          excerpt: material.text.replace(/\s+/g, ' ').trim().slice(0, 500),
          retrievedAt: material.retrievedAt,
          host: hostOf(material.url),
          identityLevel: 'weak',
          searchResultOnly: material.searchResultOnly,
          trainingDocument: true,
        };
        if (!best || (best.identityLevel === 'none')) best = candidate;
      }
      continue;
    }

    const candidate: AffiliationSourceHit = {
      url: material.url,
      title: material.title,
      excerpt: material.text.replace(/\s+/g, ' ').trim().slice(0, 500),
      retrievedAt: material.retrievedAt,
      host: hostOf(material.url),
      identityLevel,
      searchResultOnly: material.searchResultOnly,
      trainingDocument: material.trainingDocument,
    };
    const score = (h: AffiliationSourceHit) =>
      (h.identityLevel === 'strong' ? 4 : h.identityLevel === 'possible' ? 2 : 1) +
      (h.searchResultOnly ? 0 : 3) +
      (entry.class === 'appointment' && DIRECTORY_CUE.test(h.excerpt) ? 1 : 0) +
      (entry.class === 'training' && h.trainingDocument ? 2 : 0) -
      (entry.class === 'appointment' && h.trainingDocument ? 5 : 0);
    if (!best || score(candidate) > score(best)) best = candidate;
  }

  return {
    hit: best,
    restrictedOnly,
    mismatchSeen,
    ownSiteOnly:
      materials.length > 0 &&
      materials.every((m) => m.ownSite) &&
      independent.length === 0,
  };
}

function assessOne(
  entry: AffiliationEntry,
  options: AssessInstitutionalAffiliationsOptions,
  gathered: Awaited<ReturnType<typeof gatherMaterials>>,
  retrievedAt: string,
): AffiliationAssessment {
  const limitations: string[] = [];
  const base = {
    id: `affil-assess-${entry.id}`,
    entry,
    institutionCanonical: entry.institution,
    queriesRun: gathered.queriesRun,
    retrievedAt,
  };

  if (!entry.institution?.trim()) {
    return {
      ...base,
      status: 'not_independently_verified',
      evidence: null,
      explanation: `${AFFILIATION_STATUS_LABEL.not_independently_verified} — the CV claim does not name an institution clearly enough to search a directory.`,
      limitations: [
        'No institution was inventively added. Search only institutions named in claims.',
      ],
    };
  }

  const picked = pickBestHit(
    gathered.materials,
    entry,
    options.expertName,
    options.specialty,
    options.city,
  );

  let status: AffiliationVerificationStatus;
  const evidence = picked.hit;

  if (picked.ownSiteOnly) {
    status = 'self_reported';
    limitations.push(
      'Only the expert’s own website or CV restates this affiliation; own-site statements are not independent verification.',
    );
  } else if (
    (gathered.loginBlocked || picked.restrictedOnly) &&
    !picked.hit
  ) {
    status = 'unable_to_access';
    limitations.push(
      'The institutional directory or profile could not be accessed publicly (login, CAPTCHA, or paywall). That is not proof the affiliation is false.',
    );
  } else if (
    gathered.searchFailed &&
    !picked.hit &&
    gathered.materials.length === 0
  ) {
    status = 'unable_to_access';
    limitations.push(
      'Institution-scoped search failed technically and was not treated as proof that no affiliation exists.',
    );
  } else if (
    gathered.allFetchesFailed &&
    !picked.hit &&
    gathered.searchAttempted
  ) {
    status = 'unable_to_access';
    limitations.push('Institutional pages were unavailable or restricted.');
  } else if (entry.class === 'training') {
    if (
      picked.hit &&
      (picked.hit.trainingDocument ||
        picked.hit.identityLevel === 'strong' ||
        picked.hit.identityLevel === 'possible')
    ) {
      status = 'training_or_practicum_confirmed';
      if (picked.hit.searchResultOnly) {
        limitations.push(
          'Training/practicum confirmation relies in part on a search result; the full page may not have been read.',
        );
      }
      limitations.push(
        'Training, practicum, internship, residency, or fellowship is not treated as a faculty or staff appointment.',
      );
    } else if (
      gathered.searchAttempted ||
      gathered.materials.some((m) => !m.restricted && !m.ownSite)
    ) {
      status = 'not_independently_verified';
      limitations.push(
        'No independent institutional training listing confirmed this placement in this run. That is not proof the training did not occur.',
      );
    } else if (!options.search && !options.dossier) {
      status = 'self_reported';
      limitations.push(
        'The training claim appears on the CV; no independent institutional look-up ran in this assessment.',
      );
    } else {
      status = 'self_reported';
      limitations.push(
        'The training claim appears on the CV; independent confirmation was not established in this run.',
      );
    }
  } else if (
    picked.hit?.identityLevel === 'strong' &&
    !picked.hit.searchResultOnly &&
    !picked.hit.trainingDocument
  ) {
    if (
      entry.timeframe === 'historical' ||
      entry.relationshipType === 'historical_appointment'
    ) {
      status = 'historical_appointment_verified';
    } else if (entry.title || entry.startYear || entry.endYear) {
      // Title/dates on CV; page may not restate all fields.
      const pageHasTitle =
        entry.title &&
        picked.hit.excerpt.toLowerCase().includes(
          entry.title.toLowerCase().split(/\s+/).slice(0, 2).join(' '),
        );
      status = pageHasTitle
        ? 'independently_verified'
        : 'partially_verified';
      if (!pageHasTitle) {
        limitations.push(
          'The institutional page confirms the person; the exact title or dates from the CV were not fully restated on the page.',
        );
      }
    } else {
      status = 'partially_verified';
      limitations.push(
        'The institutional page confirms the person; title or dates were not fully corroborated.',
      );
    }
  } else if (
    picked.hit?.identityLevel === 'strong' &&
    picked.hit.searchResultOnly
  ) {
    status = 'potential_match_unconfirmed';
    limitations.push(
      'A search result appears to match, but the institutional profile page was not fully read, so the appointment is not marked independently verified.',
    );
  } else if (
    picked.hit?.identityLevel === 'possible' ||
    picked.hit?.identityLevel === 'weak'
  ) {
    status = 'potential_match_unconfirmed';
    limitations.push(
      'A possible institutional listing was found, but identity corroboration was insufficient to confirm it belongs to the investigated expert.',
    );
  } else if (
    gathered.searchAttempted ||
    gathered.materials.some((m) => !m.restricted && !m.ownSite)
  ) {
    status = 'no_matching_record';
    if (picked.mismatchSeen) {
      limitations.push(
        'At least one similarly named listing was rejected as an identity mismatch.',
      );
    }
    limitations.push(
      'The institution-scoped directory search found no matching public record. That is not proof the appointment is false.',
    );
  } else if (!options.search && !options.dossier) {
    status = 'self_reported';
    limitations.push(
      'The affiliation appears on the CV; no independent institutional look-up ran in this assessment.',
    );
  } else {
    status = 'self_reported';
    limitations.push(
      'The affiliation appears on the CV; independent confirmation from an institutional directory was not established in this run.',
    );
  }

  const typeLabel = RELATIONSHIP_TYPE_LABEL[entry.relationshipType];
  const explanation = `${AFFILIATION_STATUS_LABEL[status]} — ${typeLabel}${
    entry.institution ? ` at ${entry.institution}` : ''
  }${entry.title ? ` (${entry.title})` : ''}.`;

  return {
    ...base,
    status,
    evidence,
    explanation,
    limitations,
  };
}

/**
 * Assess CV institutional affiliations against institution-scoped directories
 * and training listings only. Never invents affiliations; never treats
 * OpenAlex / publishers as appointment proof.
 */
export async function assessInstitutionalAffiliations(
  options: AssessInstitutionalAffiliationsOptions,
): Promise<AffiliationDossier> {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const assessments: AffiliationAssessment[] = [];
  const warnings: string[] = [];

  for (const entry of options.entries) {
    try {
      const gathered = await gatherMaterials(entry, options);
      assessments.push(assessOne(entry, options, gathered, retrievedAt));
    } catch (error) {
      warnings.push(
        `Affiliation assessment failed for ${entry.institution ?? entry.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      assessments.push({
        id: `affil-assess-${entry.id}`,
        entry,
        status: 'unable_to_access',
        institutionCanonical: entry.institution,
        evidence: null,
        queriesRun: [],
        explanation: `${AFFILIATION_STATUS_LABEL.unable_to_access} — assessment error.`,
        limitations: [
          'A technical error prevented institutional look-up; that is not proof the affiliation is false.',
        ],
        retrievedAt,
      });
    }
  }

  return { assessedAt: retrievedAt, assessments, warnings };
}
