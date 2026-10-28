import { ExpertIdentityResolver } from './identity-resolver';
import { NpiRegistryClient } from './npi-registry.client';
import { parseCityState } from './location';
import {
  fakeFetch,
  nppesRecord,
  nppesRoute,
  type NppesFixture,
} from './testing/live-fakes';

const neurologist: NppesFixture = {
  npi: '1234567893',
  first: 'Jane',
  middle: 'Ann',
  last: 'Smith',
  city: 'Phoenix',
  state: 'AZ',
  taxonomy: 'Psychiatry & Neurology, Neurology',
  license: { state: 'AZ', number: '12345' },
};

function resolverFor(records: NppesFixture[]) {
  const fake = fakeFetch([nppesRoute(records)]);
  return {
    resolver: new ExpertIdentityResolver(
      new NpiRegistryClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    ),
    calls: fake.calls,
  };
}

const query = {
  expertName: 'Dr. Jane Smith',
  city: 'Phoenix, AZ',
  specialty: 'Neurology',
};

describe('ExpertIdentityResolver', () => {
  it('confirms the only record that fits name, city, and specialty', async () => {
    const { resolver } = resolverFor([
      neurologist,
      { ...neurologist, npi: '1457767758', city: 'Tucson' },
      {
        ...neurologist,
        npi: '1043159890',
        taxonomy: 'Psychiatry & Neurology, Psychiatry',
      },
    ]);
    const { resolution, record } = await resolver.resolve(query);
    expect(resolution.status).toBe('confirmed');
    expect(record?.npi).toBe('1234567893');
    expect(resolution.identity?.name).toBe('Jane Ann Smith, MD');
    expect(resolution.basis).toEqual(['name', 'practice city', 'specialty']);
  });

  it('does not confirm when two records fit', async () => {
    const { resolver } = resolverFor([
      neurologist,
      { ...neurologist, npi: '1457767758', middle: 'B' },
    ]);
    const { resolution, record } = await resolver.resolve(query);
    expect(resolution.status).toBe('ambiguous');
    expect(record).toBeNull();
    expect(resolution.candidates.map((item) => item.npi)).toEqual([
      '1234567893',
      '1457767758',
    ]);
    expect(resolution.note).toMatch(/NPI number/);
    expect(resolution.note).toMatch(
      /not required to keep searching public records/,
    );
  });

  it('confirms a single name and specialty match when no city is given', async () => {
    const { resolver } = resolverFor([
      neurologist,
      {
        ...neurologist,
        npi: '1043159890',
        middle: 'B',
        taxonomy: 'Psychiatry & Neurology, Psychiatry',
      },
    ]);
    const { resolution, record } = await resolver.resolve({
      ...query,
      city: '',
    });
    expect(resolution.status).toBe('confirmed');
    expect(record?.npi).toBe('1234567893');
    expect(resolution.basis).toEqual(['name', 'specialty']);
  });

  it('keeps same-name records apart when no city is given and both fit', async () => {
    const { resolver } = resolverFor([
      neurologist,
      { ...neurologist, npi: '1457767758', city: 'Tucson' },
    ]);
    const { resolution, record } = await resolver.resolve({
      ...query,
      city: '',
    });
    expect(resolution.status).toBe('ambiguous');
    expect(record).toBeNull();
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.note).not.toMatch(/practice city/);
  });

  it('confirms a same-metro practice city (Los Angeles ↔ Beverly Hills)', async () => {
    const { resolver } = resolverFor([
      { ...neurologist, city: 'Beverly Hills', state: 'CA' },
    ]);
    const { resolution, record } = await resolver.resolve({
      expertName: 'Jane Ann Smith',
      city: 'Los Angeles, CA',
      specialty: 'Neurology',
    });
    expect(resolution.status).toBe('confirmed');
    expect(record?.npi).toBe('1234567893');
    expect(resolution.identity?.city).toMatch(/BEVERLY HILLS/i);
    expect(resolution.basis).toEqual(['name', 'practice city', 'specialty']);
  });

  it('confirms a same-metro practice city (Phoenix ↔ Scottsdale)', async () => {
    const { resolver } = resolverFor([{ ...neurologist, city: 'Scottsdale' }]);
    const { resolution, record } = await resolver.resolve(query);
    expect(resolution.status).toBe('confirmed');
    expect(record?.npi).toBe('1234567893');
    expect(resolution.basis).toEqual(['name', 'practice city', 'specialty']);
  });

  it('keeps a same-specialty record in a different metro as a candidate only', async () => {
    const { resolver } = resolverFor([{ ...neurologist, city: 'Tucson' }]);
    const { resolution } = await resolver.resolve(query);
    expect(resolution.status).toBe('ambiguous');
    expect(resolution.candidates[0]).toMatchObject({
      npi: '1234567893',
      city: 'TUCSON',
    });
    expect(resolution.note).toMatch(/not used as a confirmed identity/);
  });

  it('matches "St. Louis" to the registry spelling "SAINT LOUIS"', async () => {
    const { resolver } = resolverFor([
      { ...neurologist, city: 'Saint Louis', state: 'MO' },
    ]);
    const { resolution } = await resolver.resolve({
      ...query,
      city: 'St. Louis, MO',
    });
    expect(resolution.status).toBe('confirmed');
  });

  it('confirms a supplied NPI and notes a different practice city outside the metro', async () => {
    const { resolver, calls } = resolverFor([
      { ...neurologist, city: 'Tucson' },
    ]);
    const { resolution, record } = await resolver.resolve({
      ...query,
      npi: '1234567893',
    });
    expect(resolution.status).toBe('confirmed');
    expect(record?.npi).toBe('1234567893');
    expect(resolution.basis).toEqual(['NPI supplied', 'name', 'specialty']);
    expect(resolution.notes[0]).toMatch(/TUCSON, AZ, not Phoenix/);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.searchParams.get('number')).toBe('1234567893');
  });

  it('treats a supplied NPI in the same metro as matching practice city', async () => {
    const { resolver } = resolverFor([{ ...neurologist, city: 'Scottsdale' }]);
    const { resolution, record } = await resolver.resolve({
      ...query,
      npi: '1234567893',
    });
    expect(resolution.status).toBe('confirmed');
    expect(record?.npi).toBe('1234567893');
    expect(resolution.basis).toEqual([
      'NPI supplied',
      'name',
      'practice city',
      'specialty',
    ]);
    expect(resolution.notes).toEqual([]);
  });

  it('rejects a supplied NPI registered to someone else', async () => {
    const { resolver } = resolverFor([
      { ...neurologist, first: 'Robert', last: 'Jones' },
    ]);
    const { resolution, record } = await resolver.resolve({
      ...query,
      npi: '1234567893',
    });
    expect(resolution.status).toBe('npi_mismatch');
    expect(record).toBeNull();
    expect(resolution.note).toMatch(/registered to Robert Ann Jones, MD/);
  });

  it('accepts a former name listed on the record', async () => {
    const { resolver } = resolverFor([
      {
        ...neurologist,
        last: 'Brown',
        otherNames: [{ first: 'Jane', last: 'Smith' }],
      },
    ]);
    const { resolution } = await resolver.resolve({
      ...query,
      npi: '1234567893',
    });
    expect(resolution.status).toBe('confirmed');
  });

  it('ignores NPI-2 organization records in a name search', async () => {
    const { resolver } = resolverFor([
      {
        ...neurologist,
        npi: '1234567890',
        organization: true,
        first: 'Jane',
        last: 'Smith',
      },
      neurologist,
    ]);
    const { resolution, record } = await resolver.resolve(query);
    expect(resolution.status).toBe('confirmed');
    expect(record?.npi).toBe('1234567893');
    expect(record?.individual).toBe(true);
    expect(resolution.candidates).toEqual([]);
  });

  it('reports not found without treating it as a negative finding', async () => {
    const { resolver } = resolverFor([]);
    const { resolution } = await resolver.resolve(query);
    expect(resolution.status).toBe('not_found');
    expect(resolution.note).toMatch(
      /not evidence that the expert is unlicensed/,
    );
  });

  function aliasResolver(first: string) {
    const fake = fakeFetch([
      {
        match: (url) => url.host === 'npiregistry.cms.hhs.gov',
        // NPPES first-name aliases return records filed under another first name.
        respond: () => ({
          result_count: 1,
          results: [nppesRecord({ ...neurologist, first, last: 'Smith' })],
        }),
      },
    ]);
    return new ExpertIdentityResolver(
      new NpiRegistryClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
  }

  it('confirms a nickname and says the registry name differs', async () => {
    const { resolution } = await aliasResolver('Robert').resolve({
      ...query,
      expertName: 'Bob Smith',
    });
    expect(resolution.status).toBe('confirmed');
    expect(resolution.notes[0]).toMatch(
      /registry lists the first name as Robert; the investigation used Bob/,
    );
  });

  it('lists a different first name as a candidate, never as confirmed', async () => {
    const { resolution } = await aliasResolver('Rupert').resolve({
      ...query,
      expertName: 'Robert Smith',
    });
    expect(resolution.status).toBe('ambiguous');
    expect(resolution.note).toMatch(/different first name/);
  });

  it('caches a resolution and retries after a failure', async () => {
    let failures = 1;
    const fake = fakeFetch([
      {
        match: () => failures-- > 0,
        status: 400,
        respond: () => ({}),
      },
      nppesRoute([neurologist]),
    ]);
    const resolver = new ExpertIdentityResolver(
      new NpiRegistryClient({ timeoutMs: 1000, fetchImpl: fake.fetch }),
    );
    await expect(resolver.resolve(query)).rejects.toThrow(/HTTP 400/);
    const first = await resolver.resolve(query);
    const callsAfterFirst = fake.calls.length;
    const second = await resolver.resolve(query);
    expect(second).toBe(first);
    expect(fake.calls).toHaveLength(callsAfterFirst);
  });
});

describe('parseCityState', () => {
  it('reads state codes and names', () => {
    expect(parseCityState('Phoenix, AZ')).toEqual({
      city: 'Phoenix',
      state: 'AZ',
    });
    expect(parseCityState('Phoenix, Arizona 85004')).toEqual({
      city: 'Phoenix',
      state: 'AZ',
    });
    expect(parseCityState('Salt Lake City UT')).toEqual({
      city: 'Salt Lake City',
      state: 'UT',
    });
    expect(parseCityState('Boston')).toEqual({ city: 'Boston', state: null });
    expect(parseCityState('Gainesville Florida')).toEqual({
      city: 'Gainesville',
      state: 'FL',
    });
    expect(parseCityState('Charleston West Virginia')).toEqual({
      city: 'Charleston',
      state: 'WV',
    });
    expect(parseCityState('New York')).toEqual({
      city: 'New York',
      state: null,
    });
  });
});
