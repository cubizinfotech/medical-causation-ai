import { fetchJson, LiveHttpError } from './live-http';
import {
  displayName,
  personNameFromParts,
  type PersonName,
} from './person-name';

export const NPI_REGISTRY_API = 'https://npiregistry.cms.hhs.gov/api/';

export function npiProfileUrl(npi: string): string {
  return `https://npiregistry.cms.hhs.gov/provider-view/${npi}`;
}

interface NppesAddress {
  address_purpose?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  telephone_number?: string;
}

interface NppesTaxonomy {
  code?: string;
  desc?: string;
  primary?: boolean;
  state?: string | null;
  license?: string | null;
}

interface NppesName {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  credential?: string;
  type?: string;
}

interface NppesRecord {
  number?: string;
  enumeration_type?: string;
  basic?: NppesName & {
    enumeration_date?: string;
    last_updated?: string;
    status?: string;
  };
  addresses?: NppesAddress[];
  practiceLocations?: NppesAddress[];
  taxonomies?: NppesTaxonomy[];
  other_names?: NppesName[];
}

interface NppesResponse {
  result_count?: number;
  results?: NppesRecord[];
  Errors?: Array<{ description?: string }>;
}

export interface NpiTaxonomy {
  code: string | null;
  description: string;
  primary: boolean;
  /** License as reported to NPPES. NPPES does not verify it. */
  licenseState: string | null;
  licenseNumber: string | null;
}

export interface NpiLocation {
  city: string;
  state: string | null;
  line: string | null;
  postalCode: string | null;
  phone: string | null;
}

export interface NpiRecord {
  npi: string;
  individual: boolean;
  /** Registered name first, then other names (former, professional). */
  names: PersonName[];
  displayName: string;
  credential: string | null;
  taxonomies: NpiTaxonomy[];
  primaryTaxonomy: string | null;
  /** Practice locations; the primary location first. */
  locations: NpiLocation[];
  enumerationDate: string | null;
  lastUpdated: string | null;
  status: string | null;
  url: string;
}

export interface NpiSearchParams {
  firstName: string;
  lastName: string;
  city?: string;
  state?: string | null;
}

export interface NpiRegistryClientOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** Read-only client for the public NPPES NPI Registry API (v2.1). */
export class NpiRegistryClient {
  constructor(private readonly options: NpiRegistryClientOptions) {}

  async byNumber(npi: string): Promise<NpiRecord | null> {
    const records = await this.request({ number: npi });
    return records[0] ?? null;
  }

  /**
   * Individual providers by name. Returns up to 600 records; NPPES caps one
   * page at 200.
   */
  async search(params: NpiSearchParams): Promise<NpiRecord[]> {
    const base: Record<string, string> = {
      enumeration_type: 'NPI-1',
      first_name: params.firstName,
      last_name: params.lastName,
      limit: '200',
    };
    if (params.city) base.city = params.city;
    if (params.state) base.state = params.state;
    const records: NpiRecord[] = [];
    for (let skip = 0; skip < 600; skip += 200) {
      const page = await this.request(
        skip > 0 ? { ...base, skip: String(skip) } : base,
      );
      records.push(...page);
      if (page.length < 200) break;
    }
    return records;
  }

  private async request(params: Record<string, string>): Promise<NpiRecord[]> {
    const url = new URL(this.options.baseUrl ?? NPI_REGISTRY_API);
    url.searchParams.set('version', '2.1');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const body = await fetchJson<NppesResponse>(url, {
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
    });
    if (body.Errors?.length) {
      throw new LiveHttpError(
        `The NPI Registry rejected the search: ${
          body.Errors.map((error) => error.description)
            .filter(Boolean)
            .join('; ') || 'invalid request'
        }.`,
        'http',
      );
    }
    return (body.results ?? [])
      .map(toRecord)
      .filter((record): record is NpiRecord => record !== null);
  }
}

function toRecord(row: NppesRecord): NpiRecord | null {
  const npi = row.number?.trim();
  if (!npi) return null;
  const basic = row.basic ?? {};
  const primaryName = personNameFromParts(
    basic.first_name,
    basic.last_name,
    basic.middle_name,
  );
  const otherNames = (row.other_names ?? [])
    .map((name) =>
      personNameFromParts(name.first_name, name.last_name, name.middle_name),
    )
    .filter((name): name is PersonName => name !== null);
  const credential = basic.credential?.trim() || null;
  const taxonomies = (row.taxonomies ?? [])
    .filter((taxonomy) => taxonomy.desc?.trim())
    .map((taxonomy) => ({
      code: taxonomy.code?.trim() || null,
      description: taxonomy.desc!.trim(),
      primary: taxonomy.primary === true,
      licenseState: taxonomy.state?.trim() || null,
      licenseNumber: taxonomy.license?.trim() || null,
    }));
  const addresses = row.addresses ?? [];
  const locations = [
    ...addresses.filter(
      (address) => address.address_purpose?.toUpperCase() === 'LOCATION',
    ),
    ...(row.practiceLocations ?? []),
  ]
    .filter((address) => address.city?.trim())
    .map((address) => ({
      city: address.city!.trim(),
      state: address.state?.trim() || null,
      line:
        [address.address_1, address.address_2]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(', ') || null,
      postalCode: address.postal_code?.trim() || null,
      phone: address.telephone_number?.trim() || null,
    }));
  const name = primaryName ? displayName(primaryName) : npi;
  return {
    npi,
    individual: row.enumeration_type === 'NPI-1',
    names: primaryName ? [primaryName, ...otherNames] : otherNames,
    displayName: credential ? `${name}, ${credential}` : name,
    credential,
    taxonomies,
    primaryTaxonomy:
      taxonomies.find((taxonomy) => taxonomy.primary)?.description ??
      taxonomies[0]?.description ??
      null,
    locations,
    enumerationDate: basic.enumeration_date?.trim() || null,
    lastUpdated: basic.last_updated?.trim() || null,
    status: basic.status?.trim() || null,
    url: npiProfileUrl(npi),
  };
}
