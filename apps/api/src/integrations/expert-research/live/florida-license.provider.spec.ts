import { EXPERT_RESEARCH_CATALOG } from '../providers/provider-catalog';
import { FloridaLicenseResearchProvider } from './florida-license.provider';
import { FloridaMqaClient } from './florida-mqa.client';
import { ExpertIdentityResolver } from './identity-resolver';
import { NpiRegistryClient } from './npi-registry.client';
import { fakeFetch, nppesRoute } from './testing/live-fakes';

const licenseDef = EXPERT_RESEARCH_CATALOG.find(
  (e) => e.id === 'state_license',
)!;
const disciplineDef = EXPERT_RESEARCH_CATALOG.find(
  (e) => e.id === 'state_discipline',
)!;

const RESULTS = `
<html><body>
<table>
<tr><th>Name</th><th>License Number</th><th>Profession</th><th>License Status</th><th>City</th><th>Discipline on File</th></tr>
<tr>
  <td>DEMERY, JASON A</td>
  <td>PY7500</td>
  <td>Psychologist</td>
  <td>Clear/Active</td>
  <td>GAINESVILLE</td>
  <td>N</td>
</tr>
</table>
<!-- ${'padding '.repeat(40)} -->
</body></html>
`;

const EMPTY = `<html><body><p>No records found.</p><!-- ${'padding '.repeat(40)} --></body></html>`;

function htmlFetch(
  impl: (url: URL, init?: RequestInit) => { status: number; body: string },
): typeof fetch {
  return (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const { status, body } = impl(url, init);
    return Promise.resolve(
      new Response(body, {
        status,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
  };
}

describe('FloridaLicenseResearchProvider', () => {
  it('verifies a matching official record and does not treat NPPES as verification', async () => {
    const nppes = fakeFetch([
      nppesRoute([
        {
          npi: '1457767758',
          first: 'Jason',
          last: 'Demery',
          city: 'Gainesville',
          state: 'FL',
          taxonomy: 'Clinical Neuropsychologist',
          license: { state: 'FL', number: 'PY7500' },
        },
      ]),
    ]);
    let mqaCalls = 0;
    const mqa = htmlFetch(() => {
      mqaCalls += 1;
      return { status: 200, body: RESULTS };
    });
    const resolver = new ExpertIdentityResolver(
      new NpiRegistryClient({ timeoutMs: 1000, fetchImpl: nppes.fetch }),
    );
    const provider = new FloridaLicenseResearchProvider(
      licenseDef,
      resolver,
      new FloridaMqaClient(mqa, 1000),
      'license',
    );
    const result = await provider.search({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('ok');
    expect(result.items[0].raw).toMatchObject({
      verificationStatus: 'official_verified',
      licenseNumber: 'PY7500',
      licenseStatus: 'Clear/Active',
      verificationSource: 'florida_doh_mqa',
    });
    expect(result.items[0].summary).toMatch(/official regulator/i);
    expect(result.items[0].summary).toMatch(/not the self-reported NPPES/i);
    expect(mqaCalls).toBeGreaterThan(0);
  });

  it('records a completed empty search when the official page is readable and has no match', async () => {
    const resolver = new ExpertIdentityResolver(
      new NpiRegistryClient({
        timeoutMs: 1000,
        fetchImpl: fakeFetch([nppesRoute([])]).fetch,
      }),
    );
    const provider = new FloridaLicenseResearchProvider(
      licenseDef,
      resolver,
      new FloridaMqaClient(
        htmlFetch(() => ({ status: 200, body: EMPTY })),
        1000,
      ),
      'license',
    );
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('no_result');
    expect(result.outcome).toBe('no_result');
    expect(result.message).toMatch(/not proof that the license is invalid/i);
    expect(result.items).toHaveLength(0);
  });

  it('reports an access wall as blocked, not as no license', async () => {
    const resolver = new ExpertIdentityResolver(
      new NpiRegistryClient({
        timeoutMs: 1000,
        fetchImpl: fakeFetch([nppesRoute([])]).fetch,
      }),
    );
    const provider = new FloridaLicenseResearchProvider(
      licenseDef,
      resolver,
      new FloridaMqaClient(
        htmlFetch(() => ({
          status: 403,
          body: 'Access denied',
        })),
        1000,
      ),
      'license',
    );
    const result = await provider.search({
      expertName: 'Jason Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('error');
    expect(result.outcome).toBe('restricted');
    expect(result.message).toMatch(/access wall/i);
    expect(result.message).toMatch(
      /not a finding that the license is invalid/i,
    );
  });

  it('does not search Florida when the expert is not tied to Florida', async () => {
    let mqaCalls = 0;
    const mqa = htmlFetch(() => {
      mqaCalls += 1;
      return { status: 200, body: RESULTS };
    });
    const resolver = new ExpertIdentityResolver(
      new NpiRegistryClient({
        timeoutMs: 1000,
        fetchImpl: fakeFetch([
          nppesRoute([
            {
              npi: '1234567893',
              first: 'Jane',
              last: 'Smith',
              city: 'Phoenix',
              state: 'AZ',
              taxonomy: 'Neurology',
              license: { state: 'AZ', number: '12345' },
            },
          ]),
        ]).fetch,
      }),
    );
    const provider = new FloridaLicenseResearchProvider(
      licenseDef,
      resolver,
      new FloridaMqaClient(mqa, 1000),
      'license',
    );
    const result = await provider.search({
      expertName: 'Jane Smith',
      city: 'Phoenix, AZ',
      specialty: 'Neurology',
    });
    expect(result.status).toBe('unavailable');
    expect(result.message).toMatch(/not accessed|other states were not queried/i);
    expect(result.message).toMatch(/AZ/);
    expect(mqaCalls).toBe(0);
  });

  it('does not claim that no discipline exists when the flag is N', async () => {
    const resolver = new ExpertIdentityResolver(
      new NpiRegistryClient({
        timeoutMs: 1000,
        fetchImpl: fakeFetch([nppesRoute([])]).fetch,
      }),
    );
    const provider = new FloridaLicenseResearchProvider(
      disciplineDef,
      resolver,
      new FloridaMqaClient(
        htmlFetch(() => ({ status: 200, body: RESULTS })),
        1000,
      ),
      'discipline',
    );
    const result = await provider.search({
      expertName: 'Jason A. Demery',
      city: 'Gainesville, FL',
      specialty: 'Neuropsychology',
    });
    expect(result.status).toBe('no_result');
    expect(result.message).toMatch(/not proof that none exists/i);
    expect(result.message).not.toMatch(/no disciplinary history/i);
    expect(result.items).toHaveLength(0);
  });
});
