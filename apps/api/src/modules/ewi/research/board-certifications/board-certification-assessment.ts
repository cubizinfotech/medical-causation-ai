import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import { canonicalUrl } from '@integrations/web-research';
import type {
  BoardCertificationAssessment,
  BoardCertificationDossier,
  BoardCertificationEntry,
  BoardCertificationSourceHit,
  BoardCertificationStatus,
} from './board-certification.types';
import { BOARD_CERTIFICATION_STATUS_LABEL } from './board-certification.types';
import {
  boardById,
  queryHostsForBoard,
  resolveCertifyingBoard,
  type RegisteredCertifyingBoard,
} from './certification-registry';

export interface BoardCertificationSearchHit {
  url: string;
  title?: string | null;
  snippet?: string | null;
}

export interface BoardCertificationFetchResult {
  url: string;
  title?: string | null;
  text: string;
  retrievedAt?: string;
  restricted?: boolean;
  loginRequired?: boolean;
}

export interface AssessBoardCertificationsOptions {
  entries: BoardCertificationEntry[];
  expertName: string;
  specialty?: string | null;
  city?: string | null;
  dossier?: WebResearchDossier | null;
  search?: (query: string) => Promise<BoardCertificationSearchHit[]>;
  fetchPage?: (
    url: string,
  ) => Promise<BoardCertificationFetchResult | null>;
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
): BoardCertificationSourceHit['identityLevel'] {
  if (similarNameMismatch(expertName, text)) return 'none';
  if (!nameAppears(expertName, text)) return 'none';
  if (specialtyAppears(specialty, text) || placeAppears(city, text)) {
    return 'strong';
  }
  if (text.replace(/\s+/g, ' ').trim().length < 80) return 'possible';
  return 'possible';
}

function belongsToBoard(
  url: string,
  board: RegisteredCertifyingBoard,
): boolean {
  const host = hostOf(url);
  return board.hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

function buildQueries(
  entry: BoardCertificationEntry,
  board: RegisteredCertifyingBoard | null,
  expertName: string,
): string[] {
  if (!board || board.searchMethod === 'none') return [];
  const quoted = `"${expertName.replace(/"/g, '')}"`;
  const specialtyBit = entry.specialty?.trim()
    ? ` "${entry.specialty.replace(/"/g, '').slice(0, 40)}"`
    : '';
  const queries: string[] = [];
  for (const host of queryHostsForBoard(board)) {
    queries.push(`site:${host} ${quoted}`);
    queries.push(
      `site:${host} ${quoted}${specialtyBit} (board OR diplomate OR certified OR directory)`,
    );
  }
  return queries.slice(0, 4);
}

function materialsFromDossier(
  dossier: WebResearchDossier | null | undefined,
  board: RegisteredCertifyingBoard,
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
    if (!belongsToBoard(record.url, board)) continue;
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
    if (!belongsToBoard(blocked.url, board)) continue;
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
  entry: BoardCertificationEntry,
  board: RegisteredCertifyingBoard | null,
  options: AssessBoardCertificationsOptions,
): Promise<{
  materials: ReturnType<typeof materialsFromDossier>;
  queriesRun: string[];
  searchFailed: boolean;
  searchAttempted: boolean;
  allFetchesFailed: boolean;
  loginBlocked: boolean;
}> {
  const queriesRun = buildQueries(entry, board, options.expertName);
  const materials = board
    ? materialsFromDossier(options.dossier, board)
    : [];
  const seen = new Set(materials.map((m) => canonicalUrl(m.url)));
  let searchFailed = false;
  let searchAttempted = false;
  let attemptedFetches = 0;
  let failedFetches = 0;
  let loginBlocked = false;

  if (!board || board.searchMethod === 'none' || !options.search) {
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
    let hits: BoardCertificationSearchHit[] = [];
    try {
      hits = await options.search(query);
    } catch {
      searchFailed = true;
      continue;
    }
    for (const hit of hits.slice(0, 5)) {
      if (!belongsToBoard(hit.url, board)) continue;
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
  hit: BoardCertificationSourceHit | null;
  restrictedOnly: boolean;
  mismatchSeen: boolean;
} {
  let best: BoardCertificationSourceHit | null = null;
  let restrictedOnly =
    materials.length > 0 && materials.every((m) => m.restricted);
  let mismatchSeen = false;
  for (const material of materials) {
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
    const candidate: BoardCertificationSourceHit = {
      url: material.url,
      title: material.title,
      excerpt: material.text.replace(/\s+/g, ' ').trim().slice(0, 500),
      retrievedAt: material.retrievedAt,
      host: hostOf(material.url),
      identityLevel,
      searchResultOnly: material.searchResultOnly,
    };
    const score = (h: BoardCertificationSourceHit) =>
      (h.identityLevel === 'strong' ? 3 : h.identityLevel === 'possible' ? 2 : 1) +
      (h.searchResultOnly ? 0 : 2);
    if (!best || score(candidate) > score(best)) best = candidate;
  }
  return { hit: best, restrictedOnly, mismatchSeen };
}

function assessOne(
  entry: BoardCertificationEntry,
  options: AssessBoardCertificationsOptions,
  gathered: Awaited<ReturnType<typeof gatherMaterials>>,
  board: RegisteredCertifyingBoard | null,
  retrievedAt: string,
): BoardCertificationAssessment {
  const limitations: string[] = [];
  const base = {
    id: `bc-assess-${entry.id}`,
    entry,
    boardCanonical: board?.canonicalName ?? entry.boardName,
    officialWebsite: board?.homeUrl ?? null,
    verificationUrl: board?.verificationUrl ?? null,
    access: board?.access ?? null,
    queriesRun: gathered.queriesRun,
    retrievedAt,
  };

  if (!board) {
    return {
      ...base,
      status: 'insufficient_information',
      evidence: null,
      explanation: `${BOARD_CERTIFICATION_STATUS_LABEL.insufficient_information} for the claimed credential — the certifying organization could not be identified confidently.`,
      limitations: [
        'The CV claim does not identify a known certifying board clearly enough to run an official verification look-up. No unrelated boards were searched.',
      ],
    };
  }

  if (board.searchMethod === 'none') {
    return {
      ...base,
      status: 'not_checked',
      evidence: null,
      explanation: `${BOARD_CERTIFICATION_STATUS_LABEL.not_checked} for ${board.canonicalName}.`,
      limitations: [
        `${board.canonicalName} does not provide a usable public automated verification method through this system.`,
      ],
    };
  }

  const specialtyForMatch =
    entry.specialty || options.specialty || entry.credentialName;
  const picked = pickBestHit(
    gathered.materials,
    options.expertName,
    specialtyForMatch,
    options.city,
  );

  let status: BoardCertificationStatus;
  const evidence = picked.hit;

  if (
    (gathered.loginBlocked ||
      picked.restrictedOnly ||
      board.access === 'login_required') &&
    !picked.hit
  ) {
    status = 'unable_to_access';
    limitations.push(
      'The official verification source could not be accessed publicly (login, CAPTCHA, or paywall). That is not proof the certification is false.',
    );
  } else if (gathered.searchFailed && !picked.hit && gathered.materials.length === 0) {
    status = 'unable_to_access';
    limitations.push(
      'Official board search failed technically and was not treated as proof that no certification exists.',
    );
  } else if (
    gathered.allFetchesFailed &&
    !picked.hit &&
    gathered.searchAttempted
  ) {
    status = 'unable_to_access';
    limitations.push('Official board pages were unavailable or restricted.');
  } else if (
    picked.hit?.identityLevel === 'strong' &&
    !picked.hit.searchResultOnly
  ) {
    status = entry.specialty || entry.certificationDate
      ? 'verified'
      : 'partially_verified';
    if (!entry.specialty && !entry.certificationDate) {
      limitations.push(
        'The official directory confirms the person; specialty or dates from the CV were not fully corroborated on the page.',
      );
      status = 'partially_verified';
    }
  } else if (
    picked.hit?.identityLevel === 'strong' &&
    picked.hit.searchResultOnly
  ) {
    status = 'potential_match_unconfirmed';
    limitations.push(
      'A search result appears to match, but the official profile page was not fully read, so the certification is not marked verified.',
    );
  } else if (
    picked.hit?.identityLevel === 'possible' ||
    picked.hit?.identityLevel === 'weak'
  ) {
    status = 'potential_match_unconfirmed';
    limitations.push(
      'A possible directory listing was found, but identity corroboration was insufficient to confirm it belongs to the investigated expert.',
    );
  } else if (gathered.searchAttempted || gathered.materials.some((m) => !m.restricted)) {
    status = 'no_matching_record';
    if (picked.mismatchSeen) {
      limitations.push(
        'At least one similarly named listing was rejected as an identity mismatch.',
      );
    }
    limitations.push(
      'The official verification source was searched and no matching public record was found. That is not proof the certification is false.',
    );
  } else if (!options.search && !options.dossier) {
    status = 'self_reported';
    limitations.push(
      'The credential appears on the CV; no independent board look-up ran in this assessment.',
    );
  } else {
    status = 'self_reported';
    limitations.push(
      'The credential appears on the CV; independent confirmation from the issuing board was not established in this run.',
    );
  }

  return {
    ...base,
    status,
    evidence,
    explanation: `${BOARD_CERTIFICATION_STATUS_LABEL[status]} for ${
      entry.credentialName ?? 'board certification'
    } at ${board.canonicalName}.`,
    limitations,
  };
}

/** Assess each CV board-certification claim against its mapped issuing board only. */
export async function assessBoardCertifications(
  options: AssessBoardCertificationsOptions,
): Promise<BoardCertificationDossier> {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const assessments: BoardCertificationAssessment[] = [];
  const warnings: string[] = [];

  if (options.entries.length === 0) {
    return {
      assessedAt: retrievedAt,
      assessments: [],
      warnings: [
        'No board certification claims were extracted from the CV for verification.',
      ],
    };
  }

  for (const entry of options.entries) {
    const board =
      (entry.boardId ? boardById(entry.boardId) : null) ??
      resolveCertifyingBoard(entry.boardName);
    const gathered = await gatherMaterials(entry, board, options);
    assessments.push(
      assessOne(entry, options, gathered, board, retrievedAt),
    );
  }

  return { assessedAt: retrievedAt, assessments, warnings };
}

/** Synchronous fixture path for unit tests. */
export function assessBoardCertificationsFromMaterials(
  entries: BoardCertificationEntry[],
  materialsByBoardId: Record<
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
    searchFailed?: boolean;
    searchAttempted?: boolean;
    allFetchesFailed?: boolean;
    loginBlocked?: boolean;
    now?: () => Date;
  },
): BoardCertificationDossier {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const assessments: BoardCertificationAssessment[] = [];

  if (entries.length === 0) {
    return {
      assessedAt: retrievedAt,
      assessments: [],
      warnings: [
        'No board certification claims were extracted from the CV for verification.',
      ],
    };
  }

  for (const entry of entries) {
    const board =
      (entry.boardId ? boardById(entry.boardId) : null) ??
      resolveCertifyingBoard(entry.boardName);
    const key = board?.id ?? 'unknown';
    const raw = materialsByBoardId[key] ?? [];
    const materials = raw.map((m) => ({
      url: m.url,
      title: m.title ?? null,
      text: m.text,
      retrievedAt: m.retrievedAt ?? retrievedAt,
      restricted: Boolean(m.restricted),
      searchResultOnly: Boolean(m.searchResultOnly),
    }));
    const searchAttempted =
      options.searchAttempted ?? materials.length > 0;
    assessments.push(
      assessOne(
        entry,
        {
          entries,
          expertName: options.expertName,
          specialty: options.specialty,
          city: options.city,
        },
        {
          materials,
          queriesRun: buildQueries(entry, board, options.expertName),
          searchFailed: Boolean(options.searchFailed),
          searchAttempted,
          allFetchesFailed: Boolean(options.allFetchesFailed),
          loginBlocked: Boolean(options.loginBlocked),
        },
        board,
        retrievedAt,
      ),
    );
  }

  return { assessedAt: retrievedAt, assessments, warnings: [] };
}
