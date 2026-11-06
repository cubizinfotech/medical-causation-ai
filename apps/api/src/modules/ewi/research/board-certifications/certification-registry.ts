import type { BoardAccess, BoardSearchMethod } from './board-certification.types';

/**
 * In-code registry of certifying boards. Entries are matched from CV claims —
 * never auto-searched for every expert.
 */
export interface RegisteredCertifyingBoard {
  id: string;
  canonicalName: string;
  aliases: readonly string[];
  acronyms: readonly string[];
  hosts: readonly string[];
  homeUrl: string;
  verificationUrl: string;
  specialties: readonly string[];
  access: BoardAccess;
  searchMethod: BoardSearchMethod;
}

export const CERTIFICATION_REGISTRY: readonly RegisteredCertifyingBoard[] = [
  {
    id: 'abpp',
    canonicalName: 'American Board of Professional Psychology',
    aliases: [
      'American Board of Professional Psychology',
      'ABPP-CN',
      'ABPP CN',
      'board certified in clinical neuropsychology',
    ],
    acronyms: ['ABPP', 'ABCN'],
    hosts: ['abpp.org'],
    homeUrl: 'https://abpp.org/',
    verificationUrl: 'https://abpp.org/directory/',
    specialties: [
      'psychology',
      'clinical psychology',
      'neuropsychology',
      'clinical neuropsychology',
    ],
    access: 'public_directory',
    searchMethod: 'site_serp',
  },
  {
    id: 'abms',
    canonicalName: 'American Board of Medical Specialties',
    aliases: [
      'American Board of Medical Specialties',
      'Certification Matters',
      'ABMS Certification Matters',
    ],
    acronyms: ['ABMS'],
    hosts: ['certificationmatters.org', 'abms.org'],
    homeUrl: 'https://www.certificationmatters.org/',
    verificationUrl: 'https://www.certificationmatters.org/',
    specialties: ['medicine', 'physician', 'md', 'do'],
    access: 'public_directory',
    searchMethod: 'site_serp',
  },
  {
    id: 'abpn',
    canonicalName: 'American Board of Psychiatry and Neurology',
    aliases: [
      'American Board of Psychiatry and Neurology',
      'ABPN psychiatry',
      'ABPN neurology',
    ],
    acronyms: ['ABPN'],
    hosts: ['abpn.com'],
    homeUrl: 'https://www.abpn.com/',
    verificationUrl: 'https://www.abpn.com/verify-certification/',
    specialties: [
      'psychiatry',
      'neurology',
      'child neurology',
      'neuropsychology',
    ],
    access: 'public_directory',
    searchMethod: 'site_serp',
  },
  {
    id: 'abim',
    canonicalName: 'American Board of Internal Medicine',
    aliases: ['American Board of Internal Medicine'],
    acronyms: ['ABIM'],
    hosts: ['abim.org'],
    homeUrl: 'https://www.abim.org/',
    verificationUrl: 'https://www.abim.org/verify-physician',
    specialties: ['internal medicine', 'medicine', 'physician'],
    access: 'public_directory',
    searchMethod: 'site_serp',
  },
  {
    id: 'abp',
    canonicalName: 'American Board of Pediatrics',
    aliases: ['American Board of Pediatrics'],
    acronyms: ['ABP'],
    hosts: ['abp.org'],
    homeUrl: 'https://www.abp.org/',
    verificationUrl: 'https://www.abp.org/verify-certification',
    specialties: ['pediatrics', 'medicine', 'physician'],
    access: 'public_directory',
    searchMethod: 'site_serp',
  },
  {
    id: 'abos',
    canonicalName: 'American Board of Orthopaedic Surgery',
    aliases: [
      'American Board of Orthopaedic Surgery',
      'American Board of Orthopedic Surgery',
    ],
    acronyms: ['ABOS'],
    hosts: ['abos.org'],
    homeUrl: 'https://www.abos.org/',
    verificationUrl: 'https://www.abos.org/verify-certification/',
    specialties: ['orthopaedic', 'orthopedic', 'surgery'],
    access: 'public_directory',
    searchMethod: 'site_serp',
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
 * Resolve a claimed board / credential string to a registry entry.
 * Does not invent matches; AACN/NAN/APA membership language does not resolve here.
 */
export function resolveCertifyingBoard(
  raw: string | null | undefined,
): RegisteredCertifyingBoard | null {
  if (!raw?.trim()) return null;
  const key = normalizeKey(raw);
  if (key.length < 2) return null;
  // Membership academies are not certifying boards for this registry.
  if (
    /\b(aacn|nan|american academy of clinical neuropsychology|national academy of neuropsychology|american psychological association)\b/i.test(
      raw,
    ) &&
    !/\b(abpp|board[\s-]?certif|diplomate)\b/i.test(raw)
  ) {
    return null;
  }

  let best: { board: RegisteredCertifyingBoard; score: number } | null = null;
  for (const board of CERTIFICATION_REGISTRY) {
    const candidates = [
      board.canonicalName,
      ...board.aliases,
      ...board.acronyms,
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
      if (!best || score > best.score) best = { board, score };
    }
  }
  if (!best || best.score < 43) return null;
  return best.board;
}

export function boardById(id: string): RegisteredCertifyingBoard | null {
  return CERTIFICATION_REGISTRY.find((b) => b.id === id) ?? null;
}

export function isCertifyingBoardHost(url: string): boolean {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return false;
  }
  return CERTIFICATION_REGISTRY.some((b) =>
    b.hosts.some((h) => host === h || host.endsWith(`.${h}`)),
  );
}

export function queryHostsForBoard(
  board: RegisteredCertifyingBoard,
): string[] {
  return [...board.hosts];
}

/** Acronyms/hosts for query planning from resolved CV claims. */
export function claimedBoardSignals(
  boardIds: readonly string[],
): { acronyms: string[]; hosts: string[] } {
  const acronyms: string[] = [];
  const hosts: string[] = [];
  for (const id of boardIds) {
    const board = boardById(id);
    if (!board) continue;
    acronyms.push(...board.acronyms);
    hosts.push(...board.hosts);
  }
  return {
    acronyms: [...new Set(acronyms)],
    hosts: [...new Set(hosts)],
  };
}
