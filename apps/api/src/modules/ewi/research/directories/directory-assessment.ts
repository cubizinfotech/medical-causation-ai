import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import { canonicalUrl } from '@integrations/web-research';
import type {
  DirectoryAdvertisingDossier,
  DirectoryAssessment,
  DirectoryResearchStatus,
  DirectorySourceHit,
} from './directory.types';
import { DIRECTORY_STATUS_LABEL } from './directory.types';
import {
  DIRECTORY_REGISTRY,
  isAdvertisingDirectoryHost,
  queryHostsForDirectory,
  resolveAdvertisingDirectory,
  type RegisteredAdvertisingDirectory,
} from './directory-registry';

export interface DirectorySearchHit {
  url: string;
  title?: string | null;
  snippet?: string | null;
}

export interface DirectoryFetchResult {
  url: string;
  title?: string | null;
  text: string;
  retrievedAt?: string;
  restricted?: boolean;
  loginRequired?: boolean;
}

export interface AssessDirectoryListingsOptions {
  expertName: string;
  specialty?: string | null;
  city?: string | null;
  dossier?: WebResearchDossier | null;
  /** Limit which registry entries to assess (tests). Default: all. */
  directories?: readonly RegisteredAdvertisingDirectory[];
  search?: (query: string) => Promise<DirectorySearchHit[]>;
  fetchPage?: (url: string) => Promise<DirectoryFetchResult | null>;
  now?: () => Date;
}

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

/** Reject clearly different first names when both surnames match. */
function similarNameMismatch(expertName: string, text: string): boolean {
  const tokens = nameTokens(expertName);
  if (tokens.length < 2) return false;
  const last = tokens[tokens.length - 1];
  const first = tokens[0];
  const hay = text.toLowerCase();
  if (!hay.includes(last)) return false;
  // Surname present but subject's first name absent, and another first-name-like token near surname.
  if (hay.includes(first) || hay.includes(`${first[0]}.`)) return false;
  const nearSurname = new RegExp(
    `\\b([a-z]{2,})\\s+${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'i',
  );
  const match = hay.match(nearSurname);
  if (!match) return false;
  const other = match[1].toLowerCase();
  if (other === first || other === `${first[0]}`) return false;
  // Common honorifics / credentials are not alternate first names.
  if (
    ['dr', 'phd', 'psyd', 'md', 'do', 'esq', 'mr', 'mrs', 'ms'].includes(other)
  ) {
    return false;
  }
  return true;
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
): DirectorySourceHit['identityLevel'] {
  if (similarNameMismatch(expertName, text)) return 'none';
  if (!nameAppears(expertName, text)) return 'none';
  const specialtyHit = specialtyAppears(specialty, text);
  const placeHit = placeAppears(city, text);
  if (specialtyHit || placeHit) return 'strong';
  if (text.replace(/\s+/g, ' ').trim().length < 80) return 'possible';
  return 'possible';
}

function buildQueries(
  dir: RegisteredAdvertisingDirectory,
  expertName: string,
  specialty?: string | null,
): string[] {
  if (dir.searchMethod === 'none') return [];
  const quoted = `"${expertName.replace(/"/g, '')}"`;
  const specialtyBit = specialty?.trim()
    ? ` "${specialty.replace(/"/g, '').slice(0, 40)}"`
    : '';
  const queries: string[] = [];
  for (const host of queryHostsForDirectory(dir)) {
    queries.push(`site:${host} ${quoted}`);
    queries.push(
      `site:${host} ${quoted}${specialtyBit} (expert OR forensic OR IME OR "expert witness")`,
    );
  }
  return queries.slice(0, 4);
}

function belongsToDirectory(
  url: string,
  dir: RegisteredAdvertisingDirectory,
): boolean {
  const host = hostOf(url);
  return dir.hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Directory advertising assessments need a profile/listing page, not an
 * unrelated article, newsletter, or uploaded PDF hosted on the same domain.
 * Homepage reachability alone is never a profile hit.
 */
export function looksLikeDirectoryProfileUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (!path || path === '/') return false;
    if (
      /\/files\/articles\//.test(path) ||
      /\/newsletters?\//.test(path) ||
      /\/blogs?\//.test(path) ||
      /\/speaker\//.test(path) ||
      /\/docs\//.test(path)
    ) {
      return false;
    }
    if (/\.pdf$/i.test(path) && !/\/(expert|experts|member|members|profile)\b/.test(path)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function materialsFromDossier(
  dossier: WebResearchDossier | null | undefined,
  dir: RegisteredAdvertisingDirectory,
): Array<{
  url: string;
  title: string | null;
  text: string;
  retrievedAt: string;
  restricted: boolean;
  searchResultOnly: boolean;
}> {
  if (!dossier) return [];
  const out: Array<{
    url: string;
    title: string | null;
    text: string;
    retrievedAt: string;
    restricted: boolean;
    searchResultOnly: boolean;
  }> = [];
  const seen = new Set<string>();
  for (const record of dossier.records) {
    if (!belongsToDirectory(record.url, dir)) continue;
    const key = canonicalUrl(record.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: record.url,
      title: record.title || null,
      text: recordText(record),
      retrievedAt: record.retrievedAt,
      restricted:
        record.read === 'restricted' ||
        /captcha|login|sign in|subscription/i.test(record.readNote ?? ''),
      searchResultOnly: record.read !== 'read',
    });
  }
  for (const blocked of dossier.pagesBlocked ?? []) {
    if (!belongsToDirectory(blocked.url, dir)) continue;
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
    });
  }
  return out;
}

async function gatherMaterials(
  dir: RegisteredAdvertisingDirectory,
  options: AssessDirectoryListingsOptions,
): Promise<{
  materials: ReturnType<typeof materialsFromDossier>;
  queriesRun: string[];
  searchFailed: boolean;
  searchAttempted: boolean;
  allFetchesFailed: boolean;
  loginBlocked: boolean;
}> {
  const queriesRun = buildQueries(dir, options.expertName, options.specialty);
  const materials = materialsFromDossier(options.dossier, dir);
  const seen = new Set(materials.map((m) => canonicalUrl(m.url)));
  let searchFailed = false;
  let searchAttempted = false;
  let attemptedFetches = 0;
  let failedFetches = 0;
  let loginBlocked = false;

  if (dir.searchMethod === 'none' || !options.search) {
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
    let hits: DirectorySearchHit[] = [];
    try {
      hits = await options.search(query);
    } catch {
      searchFailed = true;
      continue;
    }
    for (const hit of hits.slice(0, 5)) {
      if (!belongsToDirectory(hit.url, dir)) continue;
      const key = canonicalUrl(hit.url);
      if (seen.has(key)) continue;
      seen.add(key);
      let text = `${hit.title ?? ''}\n${hit.snippet ?? ''}`;
      let title = hit.title ?? null;
      let retrievedAt = (options.now?.() ?? new Date()).toISOString();
      let restricted = false;
      let searchResultOnly = true;
      if (options.fetchPage) {
        attemptedFetches += 1;
        try {
          const page = await options.fetchPage(hit.url);
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
      }
      if (text.trim().length > 0 || restricted) {
        materials.push({
          url: hit.url,
          title,
          text,
          retrievedAt,
          restricted,
          searchResultOnly,
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
  materials: ReturnType<typeof materialsFromDossier>,
  expertName: string,
  specialty: string | null | undefined,
  city: string | null | undefined,
): {
  hit: DirectorySourceHit | null;
  restrictedOnly: boolean;
  mismatchSeen: boolean;
} {
  let best: DirectorySourceHit | null = null;
  let restrictedOnly =
    materials.length > 0 && materials.every((m) => m.restricted);
  let mismatchSeen = false;
  for (const material of materials) {
    if (!looksLikeDirectoryProfileUrl(material.url)) {
      continue;
    }
    if (similarNameMismatch(expertName, material.text)) {
      mismatchSeen = true;
      continue;
    }
    if (material.restricted) continue;
    const identityLevel = assessIdentity(
      expertName,
      specialty,
      city,
      material.text,
    );
    if (identityLevel === 'none') continue;
    const candidate: DirectorySourceHit = {
      url: material.url,
      title: material.title,
      excerpt: material.text.replace(/\s+/g, ' ').trim().slice(0, 500),
      retrievedAt: material.retrievedAt,
      host: hostOf(material.url),
      identityLevel,
      searchResultOnly: material.searchResultOnly,
    };
    const score = (h: DirectorySourceHit) =>
      (h.identityLevel === 'strong' ? 3 : h.identityLevel === 'possible' ? 2 : 1) +
      (h.searchResultOnly ? 0 : 2);
    if (!best || score(candidate) > score(best)) best = candidate;
  }
  return { hit: best, restrictedOnly, mismatchSeen };
}

function assessOne(
  dir: RegisteredAdvertisingDirectory,
  options: AssessDirectoryListingsOptions,
  gathered: Awaited<ReturnType<typeof gatherMaterials>>,
  retrievedAt: string,
): DirectoryAssessment {
  const limitations: string[] = [];
  const base = {
    id: `dir-${dir.id}`,
    directoryId: dir.id,
    directoryName: dir.canonicalName,
    directoryType: dir.directoryType,
    homeUrl: dir.homeUrl,
    searchMethod: dir.searchMethod,
    access: dir.access,
    queriesRun: gathered.queriesRun,
    retrievedAt,
  };

  if (dir.searchMethod === 'none') {
    return {
      ...base,
      status: 'search_not_supported',
      profileUrl: null,
      evidence: null,
      explanation: `${DIRECTORY_STATUS_LABEL.search_not_supported} for ${dir.canonicalName}.`,
      limitations: [
        `${dir.canonicalName} does not provide a usable public automated search method through this system (often login-gated). That is not proof a listing does or does not exist.`,
      ],
    };
  }

  if (dir.access === 'login_required') {
    limitations.push(
      `${dir.canonicalName} typically requires login or member access for directory search.`,
    );
  }

  const picked = pickBestHit(
    gathered.materials,
    options.expertName,
    options.specialty,
    options.city,
  );

  let status: DirectoryResearchStatus;
  const evidence = picked.hit;

  if (
    (gathered.loginBlocked ||
      picked.restrictedOnly ||
      dir.access === 'login_required') &&
    !picked.hit
  ) {
    status = 'unable_to_access';
    limitations.push(
      'The directory or profile page could not be accessed publicly (login, CAPTCHA, or paywall). That is not proof no listing exists.',
    );
  } else if (gathered.searchFailed && !picked.hit && gathered.materials.length === 0) {
    status = 'unable_to_access';
    limitations.push(
      'Directory search failed technically and was not treated as proof that no profile exists.',
    );
  } else if (gathered.allFetchesFailed && !picked.hit && gathered.searchAttempted) {
    status = 'unable_to_access';
    limitations.push(
      'Candidate directory pages were unavailable or restricted after search.',
    );
  } else if (
    picked.hit?.identityLevel === 'strong' &&
    !picked.hit.searchResultOnly
  ) {
    status = 'profile_found';
  } else if (
    picked.hit?.identityLevel === 'strong' &&
    picked.hit.searchResultOnly
  ) {
    status = 'potential_match_unconfirmed';
    limitations.push(
      'A search result appears to match the expert, but the public profile page was not fully read, so the listing is not marked verified.',
    );
  } else if (
    picked.hit?.identityLevel === 'possible' ||
    picked.hit?.identityLevel === 'weak'
  ) {
    status = 'potential_match_unconfirmed';
    limitations.push(
      'A possible listing was found, but identity corroboration (specialty/location) was insufficient to confirm the profile belongs to the investigated expert.',
    );
  } else if (
    gathered.searchAttempted ||
    gathered.materials.some((m) => !m.restricted) ||
    (options.dossier &&
      (options.dossier.topics ?? []).some(
        (t) =>
          (t.topic === 'directories' ||
            t.topic === 'advertising' ||
            t.topic === 'ime') &&
          t.queries > 0,
      ))
  ) {
    // Search ran (via SERP or dossier topic coverage) with no attributable profile.
    status = 'no_matching_public_profile';
    if (picked.mismatchSeen) {
      limitations.push(
        'At least one similarly named listing was rejected as an identity mismatch.',
      );
    }
    limitations.push(
      'The directory was searched and no matching public profile was identified. That is not proof the expert has never been listed.',
    );
  } else if (!options.search && !options.dossier) {
    status = 'not_checked';
    limitations.push(
      'No web-research dossier or directory search dependency was available for this directory.',
    );
  } else {
    status = 'not_checked';
    limitations.push(
      `No dedicated ${dir.canonicalName} search results were available in this run, so the directory was not treated as successfully searched.`,
    );
  }

  return {
    ...base,
    status,
    profileUrl: evidence?.url ?? null,
    evidence,
    explanation: `${DIRECTORY_STATUS_LABEL[status]} for ${dir.canonicalName}.`,
    limitations,
  };
}

/**
 * Assess each registered advertising directory for the investigated expert.
 * Always returns one assessment per registry entry.
 */
export async function assessDirectoryListings(
  options: AssessDirectoryListingsOptions,
): Promise<DirectoryAdvertisingDossier> {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const directories = options.directories ?? DIRECTORY_REGISTRY;
  const assessments: DirectoryAssessment[] = [];
  const warnings: string[] = [];

  for (const dir of directories) {
    const gathered = await gatherMaterials(dir, options);
    assessments.push(assessOne(dir, options, gathered, retrievedAt));
  }

  return { assessedAt: retrievedAt, assessments, warnings };
}

/** Synchronous fixture path for unit tests. */
export function assessDirectoryListingsFromMaterials(
  materialsByDirectoryId: Record<
    string,
    Array<{
      url: string;
      title?: string | null;
      text: string;
      retrievedAt?: string;
      restricted?: boolean;
      searchResultOnly?: boolean;
    }>
  >,
  options: {
    expertName: string;
    specialty?: string | null;
    city?: string | null;
    directories?: readonly RegisteredAdvertisingDirectory[];
    searchFailed?: boolean;
    searchAttempted?: boolean;
    allFetchesFailed?: boolean;
    loginBlocked?: boolean;
    now?: () => Date;
    /** When true, treat directories topic as having run (dossier coverage). */
    dossierTopicsRan?: boolean;
  },
): DirectoryAdvertisingDossier {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const directories = options.directories ?? DIRECTORY_REGISTRY;
  const assessments: DirectoryAssessment[] = [];

  for (const dir of directories) {
    const raw = materialsByDirectoryId[dir.id] ?? [];
    const materials = raw.map((m) => ({
      url: m.url,
      title: m.title ?? null,
      text: m.text,
      retrievedAt: m.retrievedAt ?? retrievedAt,
      restricted: Boolean(m.restricted),
      searchResultOnly: Boolean(m.searchResultOnly),
    }));
    const searchAttempted =
      options.searchAttempted ??
      (materials.length > 0 || Boolean(options.dossierTopicsRan));
    assessments.push(
      assessOne(
        dir,
        {
          expertName: options.expertName,
          specialty: options.specialty,
          city: options.city,
          dossier: options.dossierTopicsRan
            ? ({
                topics: [{ topic: 'directories', queries: 1, hits: 0 }],
              } as unknown as WebResearchDossier)
            : null,
        },
        {
          materials,
          queriesRun: buildQueries(dir, options.expertName, options.specialty),
          searchFailed: Boolean(options.searchFailed),
          searchAttempted,
          allFetchesFailed: Boolean(options.allFetchesFailed),
          loginBlocked: Boolean(options.loginBlocked),
        },
        retrievedAt,
      ),
    );
  }

  return { assessedAt: retrievedAt, assessments, warnings: [] };
}

export { isAdvertisingDirectoryHost, resolveAdvertisingDirectory };
