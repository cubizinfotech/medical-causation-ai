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
  // "Phoenix AZ" without a comma.
  const spaced = input.trim().match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (spaced && STATE_NAMES[spaced[2].toUpperCase()]) {
    return { city: spaced[1].trim(), state: spaced[2].toUpperCase() };
  }
  return { city: input.trim(), state: null };
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

export function citiesMatch(left: string, right: string): boolean {
  const a = normalizeCity(parseCityState(left).city);
  const b = normalizeCity(parseCityState(right).city);
  return a.length > 0 && a === b;
}
