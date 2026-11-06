import type {
  DirectoryAccess,
  DirectorySearchMethod,
  DirectoryType,
} from './directory.types';

/**
 * In-code registry of third-party expert-witness / IME advertising directories.
 * Professional association directories (AACN/NAN/APA) belong under memberships,
 * not here.
 */
export interface RegisteredAdvertisingDirectory {
  id: string;
  canonicalName: string;
  aliases: readonly string[];
  hosts: readonly string[];
  homeUrl: string;
  directoryType: DirectoryType;
  searchMethod: DirectorySearchMethod;
  access: DirectoryAccess;
  /** Preferred public search or listing path hints for SERP/coverage notes. */
  directoryPaths: readonly string[];
}

export const DIRECTORY_REGISTRY: readonly RegisteredAdvertisingDirectory[] = [
  {
    id: 'jurispro',
    canonicalName: 'JurisPro',
    aliases: ['JurisPro', 'Juris Pro'],
    hosts: ['jurispro.com'],
    homeUrl: 'https://www.jurispro.com/',
    directoryType: 'expert_witness_directory',
    searchMethod: 'site_serp',
    access: 'public_directory',
    directoryPaths: ['/', '/expert'],
  },
  {
    id: 'seak',
    canonicalName: 'SEAK',
    aliases: ['SEAK', 'SEAK Experts', 'SEAK Expert Witness Directory'],
    hosts: ['seakexperts.com', 'seak.com'],
    homeUrl: 'https://www.seakexperts.com/',
    directoryType: 'expert_witness_directory',
    searchMethod: 'site_serp',
    access: 'public_directory',
    directoryPaths: ['/', '/experts'],
  },
  {
    id: 'expertpages',
    canonicalName: 'ExpertPages',
    aliases: ['ExpertPages', 'Expert Pages'],
    hosts: ['expertpages.com'],
    homeUrl: 'https://www.expertpages.com/',
    directoryType: 'expert_witness_directory',
    searchMethod: 'site_serp',
    access: 'public_directory',
    directoryPaths: ['/', '/experts'],
  },
  {
    id: 'expertwitness_com',
    canonicalName: 'ExpertWitness.com',
    aliases: ['ExpertWitness.com', 'Expert Witness.com'],
    hosts: ['expertwitness.com'],
    homeUrl: 'https://www.expertwitness.com/',
    directoryType: 'expert_witness_directory',
    searchMethod: 'site_serp',
    access: 'public_directory',
    directoryPaths: ['/'],
  },
  {
    id: 'alm_law',
    canonicalName: 'ALM Experts',
    aliases: ['ALM Experts', 'ALM Law Experts', 'Law.com Experts'],
    hosts: ['almexperts.com'],
    homeUrl: 'https://www.almexperts.com/',
    directoryType: 'expert_witness_directory',
    searchMethod: 'site_serp',
    access: 'public_directory',
    directoryPaths: ['/'],
  },
  {
    id: 'expertlaw',
    canonicalName: 'ExpertLaw',
    aliases: ['ExpertLaw', 'Expert Law'],
    hosts: ['expertlaw.com'],
    homeUrl: 'https://www.expertlaw.com/',
    directoryType: 'expert_witness_directory',
    searchMethod: 'site_serp',
    access: 'public_directory',
    directoryPaths: ['/'],
  },
  {
    id: 'dri',
    canonicalName: 'DRI',
    aliases: [
      'DRI',
      'Defense Research Institute',
      'DRI Expert Witness Database',
    ],
    hosts: ['dri.org'],
    homeUrl: 'https://www.dri.org/',
    directoryType: 'expert_witness_directory',
    // Member database is typically login-gated; do not claim public search.
    searchMethod: 'none',
    access: 'login_required',
    directoryPaths: ['/'],
  },
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** True when the URL host matches a registered advertising directory. */
export function isAdvertisingDirectoryHost(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return DIRECTORY_REGISTRY.some((dir) =>
    dir.hosts.some((h) => host === h || host.endsWith(`.${h}`)),
  );
}

/** Resolve a URL or host string to a registry entry. */
export function resolveAdvertisingDirectory(
  urlOrHost: string | null | undefined,
): RegisteredAdvertisingDirectory | null {
  if (!urlOrHost?.trim()) return null;
  let host = urlOrHost.trim().toLowerCase();
  try {
    if (host.includes('://')) host = hostOf(host);
    else host = host.replace(/^www\./, '');
  } catch {
    host = host.replace(/^www\./, '');
  }
  for (const dir of DIRECTORY_REGISTRY) {
    if (dir.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return dir;
    }
  }
  return null;
}

export function directoryById(
  id: string,
): RegisteredAdvertisingDirectory | null {
  return DIRECTORY_REGISTRY.find((d) => d.id === id) ?? null;
}

/** Host list used for site-scoped SERP queries. */
export function queryHostsForDirectory(
  dir: RegisteredAdvertisingDirectory,
): string[] {
  return [...dir.hosts];
}
