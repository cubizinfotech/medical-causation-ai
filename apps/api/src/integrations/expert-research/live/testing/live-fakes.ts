/** Test helpers for live adapters: a fetch that answers from a route list. */

export type FakeRoute = {
  match: (url: URL, init?: RequestInit) => boolean;
  respond: (url: URL, init?: RequestInit) => unknown;
  status?: number;
};

export interface FakeFetch {
  fetch: typeof fetch;
  calls: Array<{ url: URL; body?: unknown }>;
}

export function fakeFetch(routes: FakeRoute[]): FakeFetch {
  const calls: FakeFetch['calls'] = [];
  const impl = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const body =
      typeof init?.body === 'string'
        ? (JSON.parse(init.body) as unknown)
        : undefined;
    calls.push({ url, body });
    const route = routes.find((entry) => entry.match(url, init));
    if (!route) {
      return Promise.resolve(new Response('not found', { status: 404 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.respond(url, init)), {
        status: route.status ?? 200,
      }),
    );
  };
  return { fetch: impl, calls };
}

export interface NppesFixture {
  npi: string;
  first: string;
  last: string;
  middle?: string;
  credential?: string;
  city: string;
  state: string;
  taxonomy: string;
  license?: { state: string; number: string };
  organization?: boolean;
  otherNames?: Array<{ first: string; last: string }>;
}

export function nppesRecord(fixture: NppesFixture): Record<string, unknown> {
  return {
    number: fixture.npi,
    enumeration_type: fixture.organization ? 'NPI-2' : 'NPI-1',
    basic: {
      first_name: fixture.first.toUpperCase(),
      last_name: fixture.last.toUpperCase(),
      middle_name: fixture.middle?.toUpperCase(),
      credential: fixture.credential ?? 'MD',
      enumeration_date: '2008-05-01',
      last_updated: '2024-02-10',
      status: 'A',
    },
    addresses: [
      {
        address_purpose: 'MAILING',
        address_1: 'PO BOX 1',
        city: 'ELSEWHERE',
        state: fixture.state,
      },
      {
        address_purpose: 'LOCATION',
        address_1: '100 MAIN ST',
        city: fixture.city.toUpperCase(),
        state: fixture.state,
        postal_code: '850040000',
      },
    ],
    practiceLocations: [],
    taxonomies: [
      {
        code: '2084N0400X',
        desc: fixture.taxonomy,
        primary: true,
        state: fixture.license?.state ?? null,
        license: fixture.license?.number ?? null,
      },
    ],
    other_names: (fixture.otherNames ?? []).map((name) => ({
      first_name: name.first.toUpperCase(),
      last_name: name.last.toUpperCase(),
      type: 'Former Name',
    })),
  };
}

/** NPPES route: answers name searches from a list, filtered like the API. */
export function nppesRoute(records: NppesFixture[]): FakeRoute {
  return {
    match: (url) => url.host === 'npiregistry.cms.hhs.gov',
    respond: (url) => {
      const number = url.searchParams.get('number');
      const first = url.searchParams.get('first_name')?.toLowerCase();
      const last = url.searchParams.get('last_name')?.toLowerCase();
      const city = url.searchParams.get('city')?.toLowerCase();
      const state = url.searchParams.get('state');
      const rows = records.filter((record) => {
        if (number) return record.npi === number;
        if (
          first &&
          !record.first.toLowerCase().startsWith(first.slice(0, 3))
        ) {
          return false;
        }
        if (last && record.last.toLowerCase() !== last) return false;
        if (city && record.city.toLowerCase() !== city) return false;
        if (state && record.state !== state) return false;
        return true;
      });
      return { result_count: rows.length, results: rows.map(nppesRecord) };
    },
  };
}
