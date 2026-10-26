import type { ExpertEvidenceItem } from '@integrations/expert-research';
import {
  evidenceStatusLine,
  findingLabel,
  findingStatement,
  questionBasis,
  sourceIndexStatus,
  withoutSingleAccount,
} from './report-wording';

const item = (extra: Partial<ExpertEvidenceItem> = {}): ExpertEvidenceItem => ({
  sourceId: 'npi_registry',
  category: 'license',
  title: 'Licenses reported to the NPI Registry (NPI 1871685487)',
  summary: 'Licensed in Ohio.',
  access: 'public',
  informationStatus: 'unverified',
  ...extra,
});

describe('report wording', () => {
  it('shows an overall finding as its statement, without "not verified"', () => {
    expect(
      findingStatement(
        'Could not verify "Licenses reported to the NPI Registry (NPI 1871685487)". The npi_registry statement is not verified.',
      ),
    ).toBe('Licenses reported to the NPI Registry (NPI 1871685487)');
    expect(
      findingStatement(
        'Could not verify "McDarby v. Merck & Co., Inc. (2008)". The courtlistener statement is not verified.',
      ),
    ).toBe('McDarby v. Merck & Co., Inc. (2008)');
    expect(
      findingStatement(
        'The source open_payments supports "CMS Open Payments 2019–2025: $149,124.74 from 10 companies".',
      ),
    ).toBe('CMS Open Payments 2019–2025: $149,124.74 from 10 companies');
    // AI wording: keeps what the source says, drops the unverified sentence.
    expect(
      findingStatement(
        'The NPI Registry lists an Ohio license. This was not independently verified.',
      ),
    ).toBe('The NPI Registry lists an Ohio license.');
  });

  it('labels only outcomes worth acting on', () => {
    expect(findingLabel('verified')).toBe('Verified');
    expect(findingLabel('conflicting')).toBe('Sources disagree');
    expect(findingLabel('restricted')).toMatch(/Restricted/);
    expect(findingLabel('not_verified')).toBeNull();
    expect(findingLabel('not_found')).toBeNull();
  });

  it('drops the "not verified" caution from a question basis', () => {
    expect(
      questionBasis(
        'f2 — Evidence for this item is weak, conflicting, restricted, or not verified; treat confirmation as open.',
      ),
    ).toBe('f2');
    expect(
      questionBasis(
        'f2, https://example.com — Packet assessment is not fully verified; question reflects that uncertainty.',
      ),
    ).toBe('f2, https://example.com');
    expect(
      questionBasis(
        'source:oath_keepers — Source was unavailable; the question must not assume a negative finding.',
      ),
    ).toBe(
      'source:oath_keepers — Source was unavailable; the question must not assume a negative finding.',
    );
  });

  it('removes the "could not verify a single account" opening', () => {
    expect(
      withoutSingleAccount(
        'Could not verify a single account. Collected statements disagree around "State license".',
      ),
    ).toBe('Collected statements disagree around "State license".');
  });

  it('states an evidence-standard status on every collected record', () => {
    expect(evidenceStatusLine(item())).toBe(
      'Status: Not independently verified. Source: npi_registry.',
    );
    expect(evidenceStatusLine(item({ informationStatus: 'verified' }))).toBe(
      'Status: Verified. Source: npi_registry.',
    );
    expect(evidenceStatusLine(item({ informationStatus: 'conflicting' }))).toBe(
      'Status: Discrepancy found. Source: npi_registry.',
    );
    expect(evidenceStatusLine(item({ access: 'restricted' }))).toBe(
      'Status: Inaccessible. Source: npi_registry.',
    );
    expect(evidenceStatusLine(item({ informationStatus: 'unavailable' }))).toBe(
      'Status: Not found. Source: npi_registry.',
    );
    expect(sourceIndexStatus(item())).toBe(
      '; status: not independently verified',
    );
    expect(sourceIndexStatus(item({ informationStatus: 'verified' }))).toBe(
      '; status: verified',
    );
  });
});
