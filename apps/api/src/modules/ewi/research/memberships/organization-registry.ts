import type { MembershipOrgAccess } from './membership.types';

/**
 * In-code registry of professional organizations used when a CV claim matches.
 * Entries are for discovery matching — never auto-attributed to every expert.
 */
export interface RegisteredOrganization {
  id: string;
  canonicalName: string;
  aliases: readonly string[];
  acronyms: readonly string[];
  hosts: readonly string[];
  /** Preferred public directory or member-search path when known. */
  directoryPaths: readonly string[];
  specialties: readonly string[];
  access: MembershipOrgAccess;
  /** When true, prefer board/cert sections unless CV says member/fellow. */
  certificationPrimary?: boolean;
}

export const ORGANIZATION_REGISTRY: readonly RegisteredOrganization[] = [
  {
    id: 'aacn',
    canonicalName: 'American Academy of Clinical Neuropsychology',
    aliases: [
      'American Academy of Clinical Neuropsychology',
      'AACN member directory',
    ],
    acronyms: ['AACN'],
    hosts: ['theaacn.org'],
    // Prefer reachable public pages first; path hints are secondary for SERP.
    directoryPaths: ['/', '/find-a-neuropsychologist', '/membership'],
    specialties: ['neuropsychology', 'clinical psychology', 'psychology'],
    access: 'public_directory',
  },
  {
    id: 'nan',
    canonicalName: 'National Academy of Neuropsychology',
    aliases: ['National Academy of Neuropsychology'],
    acronyms: ['NAN'],
    hosts: ['nanonline.org'],
    directoryPaths: ['/', '/nan', '/membership'],
    specialties: ['neuropsychology', 'clinical psychology', 'psychology'],
    access: 'public_directory',
  },
  {
    id: 'apa_membership',
    canonicalName: 'American Psychological Association',
    aliases: [
      'American Psychological Association',
      'APA membership',
      'APA Member',
    ],
    acronyms: ['APA'],
    // Membership hosts only — never accreditation.apa.org (CoA).
    hosts: ['apa.org'],
    directoryPaths: ['/', '/membership', '/members'],
    specialties: ['psychology', 'clinical psychology', 'neuropsychology'],
    access: 'login_required',
  },
  {
    id: 'ins',
    canonicalName: 'International Neuropsychological Society',
    aliases: ['International Neuropsychological Society'],
    acronyms: ['INS'],
    hosts: ['the-ins.org', 'ins-organization.org'],
    directoryPaths: ['/', '/membership', '/members'],
    specialties: ['neuropsychology', 'clinical psychology', 'psychology'],
    access: 'login_required',
  },
  {
    id: 'abpp',
    canonicalName: 'American Board of Professional Psychology',
    aliases: [
      'American Board of Professional Psychology',
      'ABPP directory',
    ],
    acronyms: ['ABPP', 'ABCN'],
    hosts: ['abpp.org'],
    directoryPaths: ['/', '/directory', '/find-a-specialist'],
    specialties: ['psychology', 'clinical psychology', 'neuropsychology'],
    access: 'public_directory',
    certificationPrimary: true,
  },
];

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a CV organization string to a registry entry.
 * Prefers longest alias/acronym match; does not invent matches.
 */
export function resolveOrganization(
  raw: string | null | undefined,
): RegisteredOrganization | null {
  if (!raw?.trim()) return null;
  const key = normalizeKey(raw);
  if (key.length < 2) return null;

  let best: { org: RegisteredOrganization; score: number } | null = null;
  for (const org of ORGANIZATION_REGISTRY) {
    const candidates = [
      org.canonicalName,
      ...org.aliases,
      ...org.acronyms,
    ].map(normalizeKey);
    for (const candidate of candidates) {
      if (!candidate) continue;
      let score = 0;
      if (key === candidate) score = 100 + candidate.length;
      else if (key.includes(candidate) && candidate.length >= 3) {
        score = 50 + candidate.length;
      } else if (candidate.includes(key) && key.length >= 4) {
        score = 40 + key.length;
      } else {
        continue;
      }
      // Prefer non-certification-primary when scores tie and claim looks like membership.
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          !org.certificationPrimary &&
          best.org.certificationPrimary)
      ) {
        best = { org, score };
      }
    }
  }
  // Require a meaningful score so "Academy" alone does not match every academy.
  if (!best || best.score < 43) return null;
  return best.org;
}

export function officialWebsiteFor(
  org: RegisteredOrganization,
): string {
  const host = org.hosts[0];
  return host ? `https://www.${host.replace(/^www\./, '')}/` : '';
}

export function preferredDirectoryUrl(
  org: RegisteredOrganization,
): string | null {
  const host = org.hosts[0];
  if (!host) return null;
  const path = org.directoryPaths[0] ?? '';
  return `https://www.${host.replace(/^www\./, '')}${path}`;
}

export function isOfficialMembershipHost(
  url: string,
  org?: RegisteredOrganization | null,
): boolean {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return false;
  }
  // Never treat APA CoA accreditation host as membership evidence.
  if (/accreditation\.apa\.org/i.test(url)) return false;
  if (org) {
    return org.hosts.some(
      (h) => host === h || host.endsWith(`.${h}`) || h.endsWith(host),
    );
  }
  return ORGANIZATION_REGISTRY.some((entry) =>
    entry.hosts.some(
      (h) => host === h || host.endsWith(`.${h}`) || h.endsWith(host),
    ),
  );
}

/** Hosts to seed memberships site: queries from (excluding certification-primary). */
export function membershipQueryHostsForOrg(
  org: RegisteredOrganization,
): string[] {
  if (org.certificationPrimary) return [];
  return [...org.hosts];
}
