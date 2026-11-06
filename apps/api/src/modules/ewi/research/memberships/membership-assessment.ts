import type { WebRecord, WebResearchDossier } from '@integrations/web-research';
import type {
  MembershipAssessment,
  MembershipDossier,
  MembershipEntry,
  MembershipSourceHit,
  MembershipVerificationStatus,
} from './membership.types';
import { MEMBERSHIP_STATUS_LABEL } from './membership.types';
import {
  isOfficialMembershipHost,
  membershipQueryHostsForOrg,
  officialWebsiteFor,
  preferredDirectoryUrl,
  resolveOrganization,
  type RegisteredOrganization,
} from './organization-registry';

export interface MembershipSearchHit {
  url: string;
  title?: string | null;
  snippet?: string | null;
}

export interface MembershipFetchResult {
  url: string;
  title?: string | null;
  text: string;
  retrievedAt?: string;
  restricted?: boolean;
  loginRequired?: boolean;
}

export interface AssessMembershipsOptions {
  entries: MembershipEntry[];
  expertName: string;
  specialty?: string | null;
  city?: string | null;
  dossier?: WebResearchDossier | null;
  search?: (query: string) => Promise<MembershipSearchHit[]>;
  fetchPage?: (url: string) => Promise<MembershipFetchResult | null>;
  now?: () => Date;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
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

function specialtyAppears(specialty: string | null | undefined, text: string): boolean {
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
): MembershipSourceHit['identityLevel'] {
  if (!nameAppears(expertName, text)) return 'none';
  const specialtyHit = specialtyAppears(specialty, text);
  const placeHit = placeAppears(city, text);
  if (specialtyHit || placeHit) return 'strong';
  // Name alone on a thin directory page is only possible.
  if (text.replace(/\s+/g, ' ').trim().length < 80) return 'possible';
  return 'possible';
}

function buildQueries(
  entry: MembershipEntry,
  org: RegisteredOrganization | null,
  expertName: string,
): string[] {
  const quoted = `"${expertName.replace(/"/g, '')}"`;
  const queries: string[] = [];
  if (org) {
    for (const host of membershipQueryHostsForOrg(org)) {
      queries.push(`site:${host} ${quoted}`);
    }
    if (queries.length === 0 && org.hosts[0]) {
      // Certification-primary orgs: only when CV framed as member/fellow.
      if (
        entry.membershipType === 'member' ||
        entry.membershipType === 'fellow'
      ) {
        queries.push(`site:${org.hosts[0]} ${quoted} (member OR fellow)`);
      }
    }
  } else if (entry.organization) {
    queries.push(
      `${quoted} "${entry.organization.replace(/"/g, '')}" (member OR fellow OR membership OR directory)`,
    );
  }
  return queries;
}

function hitFromMaterial(
  url: string,
  title: string | null,
  text: string,
  retrievedAt: string,
  expertName: string,
  specialty: string | null | undefined,
  city: string | null | undefined,
): MembershipSourceHit {
  return {
    url,
    title,
    excerpt: text.replace(/\s+/g, ' ').trim().slice(0, 500),
    retrievedAt,
    host: hostOf(url),
    identityLevel: assessIdentity(expertName, specialty, city, text),
  };
}

function materialsFromDossier(
  dossier: WebResearchDossier | null | undefined,
  org: RegisteredOrganization | null,
): Array<{
  url: string;
  title: string | null;
  text: string;
  retrievedAt: string;
  restricted: boolean;
}> {
  if (!dossier) return [];
  const out: Array<{
    url: string;
    title: string | null;
    text: string;
    retrievedAt: string;
    restricted: boolean;
  }> = [];
  for (const record of dossier.records) {
    if (!isOfficialMembershipHost(record.url, org)) continue;
    out.push({
      url: record.url,
      title: record.title || null,
      text: recordText(record),
      retrievedAt: record.retrievedAt,
      restricted:
        record.read === 'restricted' ||
        /captcha|login|sign in|subscription/i.test(record.readNote ?? ''),
    });
  }
  return out;
}

async function gatherMaterials(
  entry: MembershipEntry,
  org: RegisteredOrganization | null,
  options: AssessMembershipsOptions,
): Promise<{
  materials: ReturnType<typeof materialsFromDossier>;
  queriesRun: string[];
  searchFailed: boolean;
  allFetchesFailed: boolean;
  loginBlocked: boolean;
}> {
  const queriesRun = buildQueries(entry, org, options.expertName);
  const materials = materialsFromDossier(options.dossier, org);
  let searchFailed = false;
  let attemptedFetches = 0;
  let failedFetches = 0;
  let loginBlocked = false;

  if (!options.search) {
    return {
      materials,
      queriesRun,
      searchFailed,
      allFetchesFailed: false,
      loginBlocked,
    };
  }

  for (const query of queriesRun) {
    let hits: MembershipSearchHit[] = [];
    try {
      hits = await options.search(query);
    } catch {
      searchFailed = true;
      continue;
    }
    for (const hit of hits.slice(0, 3)) {
      if (!isOfficialMembershipHost(hit.url, org) && org) continue;
      if (!org && !isOfficialMembershipHost(hit.url)) {
        // Unknown org: keep SERP hits that mention the org name.
        const blob = `${hit.title ?? ''} ${hit.snippet ?? ''}`.toLowerCase();
        if (
          !entry.organization ||
          !blob.includes(entry.organization.toLowerCase().slice(0, 12))
        ) {
          continue;
        }
      }
      if (materials.some((m) => m.url === hit.url)) continue;
      let text = `${hit.title ?? ''}\n${hit.snippet ?? ''}`;
      let title = hit.title ?? null;
      let retrievedAt = (options.now?.() ?? new Date()).toISOString();
      let restricted = false;
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
        });
      }
    }
  }

  return {
    materials,
    queriesRun,
    searchFailed,
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
  hit: MembershipSourceHit | null;
  restrictedOnly: boolean;
  nameOnlyWeak: boolean;
} {
  let best: MembershipSourceHit | null = null;
  let restrictedOnly = materials.length > 0 && materials.every((m) => m.restricted);
  let nameOnlyWeak = false;
  for (const material of materials) {
    if (material.restricted) continue;
    const candidate = hitFromMaterial(
      material.url,
      material.title,
      material.text,
      material.retrievedAt,
      expertName,
      specialty,
      city,
    );
    if (candidate.identityLevel === 'none') continue;
    if (
      candidate.identityLevel === 'possible' ||
      candidate.identityLevel === 'weak'
    ) {
      nameOnlyWeak = true;
    }
    const score = (h: MembershipSourceHit) =>
      h.identityLevel === 'strong' ? 3 : h.identityLevel === 'possible' ? 2 : 1;
    if (!best || score(candidate) > score(best)) best = candidate;
  }
  return { hit: best, restrictedOnly, nameOnlyWeak };
}

function assessOne(
  entry: MembershipEntry,
  options: AssessMembershipsOptions,
  gathered: Awaited<ReturnType<typeof gatherMaterials>>,
  org: RegisteredOrganization | null,
  retrievedAt: string,
): MembershipAssessment {
  const limitations: string[] = [];
  const organizationCanonical = org?.canonicalName ?? entry.organization;
  const officialWebsite = org ? officialWebsiteFor(org) : null;
  const directoryUrl = org ? preferredDirectoryUrl(org) : null;
  const access = org?.access ?? null;

  if (!entry.organization && !org) {
    return {
      id: `mass-${entry.id}`,
      entry,
      status: 'insufficient_information',
      organizationCanonical: null,
      officialWebsite: null,
      directoryUrl: null,
      access: null,
      evidence: null,
      queriesRun: gathered.queriesRun,
      explanation:
        'The CV membership claim does not identify an organization clearly enough to verify.',
      limitations: ['Missing or unparseable organization name.'],
      retrievedAt,
    };
  }

  if (org?.access === 'login_required' && !gathered.materials.some((m) => !m.restricted && m.text.length > 40)) {
    limitations.push(
      'This organization’s member directory typically requires login or member access; public verification may be limited.',
    );
  }

  const picked = pickBestHit(
    gathered.materials,
    options.expertName,
    options.specialty,
    options.city,
  );

  let status: MembershipVerificationStatus;
  let evidence = picked.hit;

  if (gathered.searchFailed && !picked.hit) {
    status = 'not_independently_verified';
    limitations.push('Membership directory search failed.');
  } else if (
    (gathered.loginBlocked || picked.restrictedOnly || org?.access === 'login_required') &&
    !picked.hit
  ) {
    status = 'unable_to_access';
    limitations.push(
      'The relevant membership directory could not be accessed publicly (login, CAPTCHA, or paywall). That is not proof the membership is false.',
    );
  } else if (gathered.allFetchesFailed && !picked.hit) {
    status = 'unable_to_access';
    limitations.push('Official organization pages were unavailable or restricted.');
  } else if (picked.hit?.identityLevel === 'strong') {
    status =
      entry.membershipType === 'fellow' || entry.membershipType === 'member'
        ? 'verified'
        : 'partially_verified';
    if (entry.membershipType === 'unknown') {
      status = 'partially_verified';
      limitations.push(
        'Directory confirms the person; exact membership type or dates remain unclear from the page.',
      );
    }
  } else if (picked.hit?.identityLevel === 'possible') {
    status = 'not_independently_verified';
    limitations.push(
      'A directory listing with a matching name was found, but specialty/location corroboration was insufficient to attribute membership without manual review.',
    );
  } else if (
    gathered.materials.some((m) => !m.restricted) &&
    gathered.queriesRun.length > 0 &&
    !picked.hit
  ) {
    status = 'no_matching_record';
    limitations.push(
      'The official directory was searched and no matching public record was found. A missing listing is not proof the membership is false.',
    );
  } else if (!org && entry.organization) {
    status = 'self_reported';
    limitations.push(
      'No known public membership directory was mapped for this organization; the claim remains self-reported pending official look-up.',
    );
  } else {
    status = 'self_reported';
    limitations.push(
      'Membership appears on the CV; independent confirmation was not established from official directories in this run.',
    );
  }

  // Own-site-only path: if dossier has subject_stated membership but no official hit.
  if (
    status === 'self_reported' &&
    options.dossier?.records.some((r) =>
      (r.claims ?? []).some(
        (c) => c.topic === 'membership' && c.basis === 'subject_stated',
      ),
    )
  ) {
    limitations.push(
      'A membership statement also appears on the expert’s own website or profile; own-site statements are not independent verification.',
    );
  }

  const explanation = `${MEMBERSHIP_STATUS_LABEL[status]} for ${
    entry.designation ?? entry.membershipType
  } at ${organizationCanonical ?? 'the stated organization'}.`;

  return {
    id: `mass-${entry.id}`,
    entry,
    status,
    organizationCanonical,
    officialWebsite: officialWebsite || null,
    directoryUrl,
    access,
    evidence,
    queriesRun: gathered.queriesRun,
    explanation,
    limitations,
    retrievedAt,
  };
}

function dedupKey(a: MembershipAssessment): string {
  return [
    (a.organizationCanonical ?? a.entry.organization ?? '').toLowerCase(),
    a.entry.membershipType,
    a.status,
  ].join('|');
}

/** Assess each CV membership claim against official organization directories. */
export async function assessMemberships(
  options: AssessMembershipsOptions,
): Promise<MembershipDossier> {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const assessments: MembershipAssessment[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];

  if (options.entries.length === 0) {
    return {
      assessedAt: retrievedAt,
      assessments: [],
      warnings: [
        'No membership claims were extracted from the CV for verification.',
      ],
    };
  }

  for (const entry of options.entries) {
    const org = resolveOrganization(entry.organization);
    const gathered = await gatherMaterials(entry, org, options);
    const assessment = assessOne(entry, options, gathered, org, retrievedAt);
    const key = dedupKey(assessment);
    if (seen.has(key)) continue;
    seen.add(key);
    assessments.push(assessment);
  }

  return { assessedAt: retrievedAt, assessments, warnings };
}

/** Synchronous fixture path for unit tests. */
export function assessMembershipsFromMaterials(
  entries: MembershipEntry[],
  materialsByOrg: Record<
    string,
    Array<{
      url: string;
      title?: string | null;
      text: string;
      retrievedAt?: string;
      restricted?: boolean;
    }>
  >,
  options: {
    expertName: string;
    specialty?: string | null;
    city?: string | null;
    searchFailed?: boolean;
    allFetchesFailed?: boolean;
    loginBlocked?: boolean;
    now?: () => Date;
  },
): MembershipDossier {
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const assessments: MembershipAssessment[] = [];
  const seen = new Set<string>();

  if (entries.length === 0) {
    return {
      assessedAt: retrievedAt,
      assessments: [],
      warnings: [
        'No membership claims were extracted from the CV for verification.',
      ],
    };
  }

  for (const entry of entries) {
    const org = resolveOrganization(entry.organization);
    const key = org?.id ?? entry.organization ?? 'unknown';
    const raw = materialsByOrg[key] ?? materialsByOrg[entry.organization ?? ''] ?? [];
    const materials = raw.map((m) => ({
      url: m.url,
      title: m.title ?? null,
      text: m.text,
      retrievedAt: m.retrievedAt ?? retrievedAt,
      restricted: Boolean(m.restricted),
    }));
    const assessment = assessOne(
      entry,
      {
        entries,
        expertName: options.expertName,
        specialty: options.specialty,
        city: options.city,
      },
      {
        materials,
        queriesRun: buildQueries(entry, org, options.expertName),
        searchFailed: Boolean(options.searchFailed),
        allFetchesFailed: Boolean(options.allFetchesFailed),
        loginBlocked: Boolean(options.loginBlocked),
      },
      org,
      retrievedAt,
    );
    const dkey = dedupKey(assessment);
    if (seen.has(dkey)) continue;
    seen.add(dkey);
    assessments.push(assessment);
  }

  return { assessedAt: retrievedAt, assessments, warnings: [] };
}
