const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  PR: 'Puerto Rico',
};

const CODE_BY_NAME = new Map(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
);

export interface CityState {
  city: string;
  /** Two-letter code when the input named a US state. */
  state: string | null;
}

/** State code from "AZ", "az", or "Arizona". */
export function stateCode(value: string): string | null {
  const trimmed = value.trim().replace(/\.$/, '');
  const upper = trimmed.toUpperCase();
  if (STATE_NAMES[upper]) return upper;
  return CODE_BY_NAME.get(trimmed.toLowerCase()) ?? null;
}

export function stateName(code: string | null | undefined): string | null {
  return code ? (STATE_NAMES[code.toUpperCase()] ?? null) : null;
}

/** "Phoenix, AZ", "Phoenix, Arizona 85004" or "Phoenix" -> city and state. */
export function parseCityState(input: string): CityState {
  const parts = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].replace(/\s+\d{5}(?:-\d{4})?$/, '');
    const code = stateCode(last);
    if (code) {
      return { city: parts.slice(0, -1).join(', '), state: code };
    }
  }
  // "Phoenix AZ" or "Gainesville Florida" without a comma.
  const withoutZip = input.trim().replace(/\s+\d{5}(?:-\d{4})?$/, '');
  const spaced = withoutZip.match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (spaced && STATE_NAMES[spaced[2].toUpperCase()]) {
    return { city: spaced[1].trim(), state: spaced[2].toUpperCase() };
  }
  const lower = withoutZip.toLowerCase();
  const stateNames = Object.values(STATE_NAMES).sort(
    (a, b) => b.length - a.length,
  );
  for (const name of stateNames) {
    const needle = ` ${name.toLowerCase()}`;
    if (!lower.endsWith(needle)) continue;
    const city = withoutZip.slice(0, withoutZip.length - name.length).trim();
    if (!city) continue;
    return { city, state: CODE_BY_NAME.get(name.toLowerCase()) ?? null };
  }
  return { city: withoutZip, state: null };
}

/** Lower-case city with common abbreviations spelled out ("St." -> "saint"). */
export function normalizeCity(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bst\.?\s+/g, 'saint ')
    .replace(/\bste\.?\s+/g, 'sainte ')
    .replace(/\bft\.?\s+/g, 'fort ')
    .replace(/\bmt\.?\s+/g, 'mount ')
    .replace(/\bnew york city\b/g, 'new york')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Adjacent cities that share a metro area for NPI / practice-location matching.
 * Exact equality still wins first; these groups only bridge known pairs such as
 * Los Angeles ↔ Beverly Hills so the same expert is not left "unconfirmed".
 */
const METRO_CITY_GROUPS: readonly (readonly string[])[] = [
  [
    'los angeles',
    'beverly hills',
    'santa monica',
    'west hollywood',
    'culver city',
    'century city',
    'brentwood',
    'encino',
    'sherman oaks',
    'studio city',
    'van nuys',
    'pasadena',
    'glendale',
    'burbank',
    'marina del rey',
    'pacific palisades',
  ],
  ['miami', 'miami beach', 'coral gables', 'coconut grove', 'aventura'],
  ['new york', 'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island'],
  ['san francisco', 'oakland', 'berkeley', 'daly city'],
  ['dallas', 'plano', 'irving', 'richardson', 'garland'],
  ['houston', 'pasadena', 'sugar land', 'the woodlands'],
  ['chicago', 'evanston', 'oak park', 'skokie'],
  ['phoenix', 'scottsdale', 'tempe', 'mesa', 'chandler', 'glendale'],
  ['tampa', 'st petersburg', 'saint petersburg', 'clearwater'],
  ['orlando', 'winter park', 'kissimmee'],
  ['washington', 'arlington', 'alexandria', 'bethesda', 'silver spring'],
  ['boston', 'cambridge', 'brookline', 'somerville'],
  ['atlanta', 'decatur', 'sandy springs'],
  ['seattle', 'bellevue', 'redmond', 'kirkland'],
  ['denver', 'aurora', 'lakewood', 'englewood'],
];

function metroGroupOf(city: string): readonly string[] | null {
  const normalized = normalizeCity(city);
  if (!normalized) return null;
  for (const group of METRO_CITY_GROUPS) {
    if (group.includes(normalized)) return group;
  }
  return null;
}

/** Other cities in the same metro group as `city`, excluding itself. */
export function metroPeerCities(city: string): string[] {
  const normalized = normalizeCity(parseCityState(city).city);
  const group = metroGroupOf(normalized);
  if (!group) return [];
  return group.filter((entry) => entry !== normalized);
}

export function citiesMatch(left: string, right: string): boolean {
  const a = normalizeCity(parseCityState(left).city);
  const b = normalizeCity(parseCityState(right).city);
  if (!a.length || !b.length) return false;
  if (a === b) return true;
  const group = metroGroupOf(a);
  return Boolean(group && group.includes(b));
}
