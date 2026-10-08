/** A person's name split into parts, lower-cased, without titles. */
export interface PersonName {
  first: string;
  middle: string[];
  last: string;
}

const TITLES = new Set([
  'dr',
  'doctor',
  'prof',
  'professor',
  'mr',
  'mrs',
  'ms',
]);
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
const CREDENTIALS = new Set([
  'md',
  'do',
  'phd',
  'mbbs',
  'mbchb',
  'dpm',
  'dc',
  'dds',
  'dmd',
  'psyd',
  'pharmd',
  'np',
  'pa',
  'pac',
  'rn',
  'mph',
  'ms',
  'msc',
  'mba',
  'jd',
  'facs',
  'facp',
  'facc',
  'faan',
  'faaos',
  'faapmr',
  'faafp',
  'frcpc',
  'frcs',
  'abpn',
]);

function tokens(value: string): string[] {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      // Dotted abbreviations are one token: "M.D." -> "md", "Ph.D." -> "phd".
      .replace(/\bph\.?\s?d\.?/g, 'phd')
      .replace(/\b(?:[a-z]\.){2,}/g, (m) => m.replace(/\./g, ''))
      .replace(/[^a-z\s'-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.replace(/^['-]+|['-]+$/g, ''))
      .filter(Boolean)
  );
}

/**
 * "Dr. Jane A. Smith, MD" -> { first: "jane", middle: ["a"], last: "smith" }.
 * "Smith, Jane A." is read as last name first. Returns null without two names.
 */
export function parsePersonName(input: string): PersonName | null {
  const trimmed = input.trim();
  let parts: string[];
  // "Last, First Middle[, Credential]" when the part after the comma is not
  // just credentials.
  const [beforeComma, ...afterComma] = trimmed.split(',');
  const afterTokens = tokens(afterComma.join(' '));
  const afterIsCredentials = afterTokens.every(
    (t) => CREDENTIALS.has(t.replace(/[.'-]/g, '')) || SUFFIXES.has(t),
  );
  if (afterComma.length > 0 && !afterIsCredentials) {
    parts = [...afterTokens, ...tokens(beforeComma)];
    // Drop trailing credentials that followed a second comma.
    parts = parts.filter((t) => !CREDENTIALS.has(t.replace(/[.'-]/g, '')));
  } else {
    parts = tokens(beforeComma);
  }

  const cleaned = parts
    .map((t) => t.replace(/\./g, ''))
    .filter(
      (t) =>
        t &&
        !TITLES.has(t) &&
        !SUFFIXES.has(t) &&
        !CREDENTIALS.has(t.replace(/[.'-]/g, '')),
    );
  if (cleaned.length < 2) return null;
  return {
    first: cleaned[0],
    middle: cleaned.slice(1, -1),
    last: cleaned[cleaned.length - 1],
  };
}

/** Builds a PersonName from separate fields (e.g. an NPI record). */
export function personNameFromParts(
  first: string | undefined,
  last: string | undefined,
  middle?: string,
): PersonName | null {
  const firstToken = tokens(first ?? '')[0];
  const lastTokens = tokens(last ?? '');
  if (!firstToken || lastTokens.length === 0) return null;
  return {
    first: firstToken,
    middle: tokens(middle ?? '').map((t) => t.replace(/\./g, '')),
    last: lastTokens.join(' '),
  };
}

/** Common nicknames that are not a prefix of the formal name. */
const NICKNAMES: Record<string, string[]> = {
  robert: ['bob', 'bobby', 'robby', 'robbie'],
  william: ['bill', 'billy', 'willie', 'liam'],
  james: ['jim', 'jimmy', 'jamie'],
  michael: ['mike', 'mikey'],
  richard: ['dick', 'rick', 'ricky', 'rich'],
  katherine: ['kate', 'katie', 'kathy', 'kat'],
  catherine: ['cathy', 'kate', 'katie', 'cat'],
  kathleen: ['kathy', 'kate', 'katie'],
  elizabeth: ['liz', 'lizzie', 'beth', 'betty', 'libby', 'eliza'],
  margaret: ['peggy', 'maggie', 'meg', 'marge'],
  edward: ['ted', 'teddy', 'ed', 'eddie', 'ned'],
  charles: ['chuck', 'charlie'],
  henry: ['hank', 'harry'],
  john: ['jack', 'johnny'],
  anthony: ['tony'],
  andrew: ['andy', 'drew'],
  stephen: ['steve'],
  steven: ['steve'],
  joseph: ['joe', 'joey'],
  david: ['dave'],
  lawrence: ['larry'],
  gerald: ['jerry'],
  jerome: ['jerry'],
  susan: ['sue', 'susie'],
  patricia: ['patty', 'patsy', 'trish', 'pat'],
  deborah: ['debbie', 'deb'],
  rebecca: ['becky'],
  martin: ['marty'],
  harold: ['hal', 'harry'],
  francis: ['frank'],
  eugene: ['gene'],
  theodore: ['ted', 'teddy'],
};

const FORMAL_BY_NICKNAME = new Map<string, Set<string>>();
for (const [formal, nicknames] of Object.entries(NICKNAMES)) {
  for (const nickname of nicknames) {
    const set = FORMAL_BY_NICKNAME.get(nickname) ?? new Set<string>();
    set.add(formal);
    FORMAL_BY_NICKNAME.set(nickname, set);
  }
}

/**
 * First names that can belong to the same person: equal, an initial of the
 * other ("J" / "Jane"), a short form of at least three letters ("Ravi" /
 * "Ravinder", "Rob" / "Robert"), or a common nickname ("Bob" / "Robert").
 */
export function firstNamesCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 3 && longer.startsWith(shorter)) return true;
  return (
    FORMAL_BY_NICKNAME.get(a)?.has(b) === true ||
    FORMAL_BY_NICKNAME.get(b)?.has(a) === true
  );
}

/**
 * Same person by name: first names are compatible, last names agree, and
 * middle names or initials agree when both sides give one ("Jane Smith" =
 * "Jane A. Smith", but "Jane A. Smith" != "Jane B. Smith"). Hyphenated
 * surnames must match.
 */
export function namesCompatible(a: PersonName, b: PersonName): boolean {
  if (!firstNamesCompatible(a.first, b.first)) return false;
  if (a.last.replace(/[\s'-]/g, '') !== b.last.replace(/[\s'-]/g, '')) {
    return false;
  }
  if (a.middle.length === 0 || b.middle.length === 0) return true;
  const ma = a.middle[0];
  const mb = b.middle[0];
  if (ma.length === 1 || mb.length === 1) return ma[0] === mb[0];
  return ma === mb;
}

/** "garcia-lopez" -> "Garcia-Lopez". */
export function capitalizeName(value: string): string {
  return value.replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
}

export function displayName(name: PersonName): string {
  const middle = name.middle.map((m) =>
    m.length === 1 ? `${m.toUpperCase()}.` : capitalizeName(m),
  );
  return [
    capitalizeName(name.first),
    ...middle,
    capitalizeName(name.last),
  ].join(' ');
}
