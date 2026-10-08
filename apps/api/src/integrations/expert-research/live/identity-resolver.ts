import type {
  ExpertIdentityCandidate,
  ExpertIdentityResolution,
  ExpertResearchQuery,
} from '../expert-research.types';
import { citiesMatch, parseCityState } from './location';
import { NpiRegistryClient, type NpiRecord } from './npi-registry.client';
import {
  capitalizeName,
  displayName,
  namesCompatible,
  parsePersonName,
  type PersonName,
} from './person-name';
import { specialtyStems, taxonomyMatches } from './specialty-match';

export interface ResolvedExpertIdentity {
  resolution: ExpertIdentityResolution;
  /** The NPI record when the identity is confirmed. */
  record: NpiRecord | null;
}

const MAX_CANDIDATES = 10;

/**
 * Ties the expert to one NPI Registry record. Later sources (Open Payments,
 * OpenAlex, CourtListener) use the confirmed record, so a same-name stranger
 * is never merged in. Results are cached per query; failures are not.
 */
export class ExpertIdentityResolver {
  private readonly cache = new Map<
    string,
    { storedAt: number; value: Promise<ResolvedExpertIdentity> }
  >();

  constructor(
    private readonly client: NpiRegistryClient,
    private readonly ttlMs = 30 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  resolve(query: ExpertResearchQuery): Promise<ResolvedExpertIdentity> {
    const key = cacheKey(query);
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.storedAt < this.ttlMs) {
      return cached.value;
    }
    const value = this.lookup(query);
    this.cache.set(key, { storedAt: this.now(), value });
    value.catch(() => {
      if (this.cache.get(key)?.value === value) this.cache.delete(key);
    });
    return value;
  }

  private async lookup(
    query: ExpertResearchQuery,
  ): Promise<ResolvedExpertIdentity> {
    const name = parsePersonName(query.expertName);
    const location = parseCityState(query.city);
    if (query.npi) {
      return this.bySuppliedNpi(query, query.npi, name, location.city);
    }
    if (!name) {
      return unresolved(
        'not_found',
        'Enter the expert’s first and last name to search the NPI Registry.',
      );
    }

    const variants = nameVariants(name);
    const named = (record: NpiRecord) => individualNamed(record, variants);
    const comparesSpecialty = specialtyStems(query.specialty).length > 0;
    const fits = (record: NpiRecord) =>
      inCity(record, location.city) &&
      (!comparesSpecialty || hasSpecialty(record, query.specialty));

    let pool: NpiRecord[] = [];
    let confirmed: NpiRecord[] = [];
    for (const variant of variants) {
      const inCityRecords = await this.client.search({
        firstName: variant.first,
        lastName: variant.last,
        city: location.city,
        state: location.state,
      });
      pool = merge(pool, inCityRecords);
      confirmed = pool.filter((record) => named(record) && fits(record));
      if (confirmed.length > 0) break;
      // NPPES matches the city text exactly ("St. Louis" vs "SAINT LOUIS"),
      // so also search by name alone and compare cities here.
      const byName = await this.client.search({
        firstName: variant.first,
        lastName: variant.last,
        state: location.state,
      });
      pool = merge(pool, byName);
      confirmed = pool.filter((record) => named(record) && fits(record));
      if (confirmed.length > 0 || pool.some(named)) break;
    }

    const basis = ['name', 'practice city'];
    if (comparesSpecialty) basis.push('specialty');
    if (confirmed.length === 1) {
      const record = confirmed[0];
      return {
        record,
        resolution: {
          status: 'confirmed',
          identity: candidateOf(record),
          basis,
          note: `NPI ${record.npi} (${describe(record)}) is the only NPI Registry record that matches the name, practice city${comparesSpecialty ? ', and specialty' : ''}.`,
          notes: [
            ...nameVariantNote(record, name),
            ...(comparesSpecialty
              ? []
              : [
                  'The specialty was too general to compare with the registry taxonomy.',
                ]),
          ],
          candidates: [],
        },
      };
    }
    if (confirmed.length > 1) {
      return ambiguous(
        confirmed,
        `${confirmed.length} NPI Registry records match the name, practice city${comparesSpecialty ? ', and specialty' : ''}. Identity was not confirmed. Add the expert’s NPI to the investigation to confirm it.`,
      );
    }

    const sameName = pool.filter(named);
    const sameSpecialty = comparesSpecialty
      ? sameName.filter((record) => hasSpecialty(record, query.specialty))
      : [];
    if (sameSpecialty.length > 0) {
      return ambiguous(
        sameSpecialty,
        `No NPI Registry record matches the name and specialty in ${location.city}, but ${sameSpecialty.length} record(s) match the name and specialty elsewhere. The expert may practice in a nearby city or may have moved. Identity was not confirmed. Add the expert’s NPI to confirm it.`,
      );
    }
    const sameCity = sameName.filter((record) => inCity(record, location.city));
    if (sameCity.length > 0) {
      return ambiguous(
        sameCity,
        `${sameCity.length} NPI Registry record(s) match the name in ${location.city}, but the registry taxonomy does not match “${query.specialty}”. Identity was not confirmed. Add the expert’s NPI to confirm it.`,
      );
    }
    const nicknames = pool.filter(
      (record) =>
        record.individual &&
        record.names.some((other) =>
          variants.some((variant) => sameSurname(other, variant)),
        ) &&
        fits(record),
    );
    if (nicknames.length > 0) {
      return ambiguous(
        nicknames,
        `The NPI Registry lists ${nicknames.length} record(s) in ${location.city} with the same last name and specialty but a different first name (for example a nickname). Identity was not confirmed. Add the expert’s NPI to confirm it.`,
      );
    }
    return unresolved(
      'not_found',
      `No NPI Registry record matched ${displayName(name)}${comparesSpecialty ? ` (${query.specialty})` : ''} in ${location.city}${sameName.length > 0 ? `. ${sameName.length} record(s) share the name but not the city or specialty` : ''}. The registry lists US clinicians with an NPI; a missing record is not evidence that the expert is unlicensed.`,
    );
  }

  private async bySuppliedNpi(
    query: ExpertResearchQuery,
    npi: string,
    name: PersonName | null,
    city: string,
  ): Promise<ResolvedExpertIdentity> {
    const record = await this.client.byNumber(npi);
    if (!record) {
      return unresolved(
        'not_found',
        `No NPI Registry record exists for NPI ${npi}. The number may be mistyped or deactivated.`,
      );
    }
    if (!record.individual) {
      return unresolved(
        'npi_mismatch',
        `NPI ${npi} belongs to an organization (${record.displayName}), not an individual clinician. Check the NPI.`,
      );
    }
    const matchesName =
      name !== null && individualNamed(record, nameVariants(name));
    if (!matchesName) {
      return {
        record: null,
        resolution: {
          status: 'npi_mismatch',
          identity: null,
          basis: [],
          note: `NPI ${npi} is registered to ${record.displayName}, not ${query.expertName}. Check the NPI. Nothing from the registry was attributed to the expert.`,
          notes: [],
          candidates: [candidateOf(record)],
        },
      };
    }
    const basis = ['NPI supplied', 'name'];
    const notes: string[] = name ? nameVariantNote(record, name) : [];
    if (inCity(record, city)) {
      basis.push('practice city');
    } else {
      const where = record.locations[0];
      notes.push(
        where
          ? `The NPI Registry lists the practice location as ${where.city}${where.state ? `, ${where.state}` : ''}, not ${city}.`
          : 'The NPI Registry lists no practice location.',
      );
    }
    if (hasSpecialty(record, query.specialty)) {
      basis.push('specialty');
    } else {
      notes.push(
        `The registry taxonomy (${record.primaryTaxonomy ?? 'none listed'}) does not match “${query.specialty}”. Taxonomy is self-reported and is not board certification.`,
      );
    }
    return {
      record,
      resolution: {
        status: 'confirmed',
        identity: candidateOf(record),
        basis,
        note: `NPI ${npi} was supplied and is registered to ${describe(record)}.`,
        notes,
        candidates: [],
      },
    };
  }
}

function cacheKey(query: ExpertResearchQuery): string {
  return [query.expertName, query.city, query.specialty, query.npi ?? '']
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

/**
 * "Maria Jose Garcia Lopez" may be filed as last name "GARCIA LOPEZ".
 * The plain reading is tried first.
 */
function nameVariants(name: PersonName): PersonName[] {
  const variants = [name];
  if (name.middle.length > 0) {
    variants.push({
      first: name.first,
      middle: name.middle.slice(0, -1),
      last: `${name.middle[name.middle.length - 1]} ${name.last}`,
    });
  }
  return variants;
}

function individualNamed(record: NpiRecord, variants: PersonName[]): boolean {
  return (
    record.individual &&
    record.names.some((other) =>
      variants.some((variant) => namesCompatible(other, variant)),
    )
  );
}

/** Says so when the registry's first name is a variant of the one entered. */
function nameVariantNote(record: NpiRecord, name: PersonName): string[] {
  const registered = record.names[0];
  if (!registered || registered.first === name.first) return [];
  return [
    `Matched a name variant: the registry lists the first name as ${capitalizeName(registered.first)}; the investigation used ${capitalizeName(name.first)}.`,
  ];
}

function sameSurname(left: PersonName, right: PersonName): boolean {
  const strip = (value: string) => value.replace(/[\s'-]/g, '');
  return strip(left.last) === strip(right.last);
}

function inCity(record: NpiRecord, city: string): boolean {
  return record.locations.some((location) => citiesMatch(location.city, city));
}

function hasSpecialty(record: NpiRecord, specialty: string): boolean {
  return record.taxonomies.some((taxonomy) =>
    taxonomyMatches(specialty, taxonomy.description),
  );
}

function merge(left: NpiRecord[], right: NpiRecord[]): NpiRecord[] {
  const seen = new Set(left.map((record) => record.npi));
  return [...left, ...right.filter((record) => !seen.has(record.npi))];
}

function describe(record: NpiRecord): string {
  const where = record.locations[0];
  const parts = [
    record.primaryTaxonomy,
    where ? `${where.city}${where.state ? `, ${where.state}` : ''}` : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `${record.displayName} — ${parts.join(', ')}`
    : record.displayName;
}

export function candidateOf(record: NpiRecord): ExpertIdentityCandidate {
  const where = record.locations[0];
  return {
    npi: record.npi,
    name: record.displayName,
    credential: record.credential,
    taxonomy: record.primaryTaxonomy,
    city: where?.city ?? null,
    state: where?.state ?? null,
    url: record.url,
  };
}

function ambiguous(records: NpiRecord[], note: string): ResolvedExpertIdentity {
  return {
    record: null,
    resolution: {
      status: 'ambiguous',
      identity: null,
      basis: [],
      note,
      notes:
        records.length > MAX_CANDIDATES
          ? [`Showing ${MAX_CANDIDATES} of ${records.length} possible records.`]
          : [],
      candidates: records.slice(0, MAX_CANDIDATES).map(candidateOf),
    },
  };
}

function unresolved(
  status: 'not_found' | 'npi_mismatch',
  note: string,
): ResolvedExpertIdentity {
  return {
    record: null,
    resolution: {
      status,
      identity: null,
      basis: [],
      note,
      notes: [],
      candidates: [],
    },
  };
}
