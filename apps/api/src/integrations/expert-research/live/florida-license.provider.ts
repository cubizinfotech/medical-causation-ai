import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import {
  FLORIDA_MQA_SEARCH,
  type FloridaLicenseHit,
  type FloridaMqaClient,
} from './florida-mqa.client';
import type { ExpertIdentityResolver } from './identity-resolver';
import { parseCityState } from './location';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import type { NpiRecord } from './npi-registry.client';
import {
  displayName,
  namesCompatible,
  parsePersonName,
  type PersonName,
} from './person-name';

export type FloridaLookupKind = 'license' | 'discipline';

/**
 * Official Florida DOH MQA lookup. NPPES license numbers are a search hint
 * only; they are not treated as verification.
 */
export class FloridaLicenseResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly resolver: ExpertIdentityResolver,
    private readonly client: FloridaMqaClient,
    private readonly kind: FloridaLookupKind = 'license',
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    const name = parsePersonName(query.expertName);
    if (!name) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. The Florida license lookup needs the expert’s first and last name.',
      };
    }

    const record = await this.npiRecord(query);
    const reported = floridaLicensesFrom(record);
    const inFlorida = parseCityState(query.city).state === 'FL';
    if (!inFlorida && reported.length === 0) {
      const state = parseCityState(query.city).state;
      const stateLabel = state ? ` (${state})` : '';
      return {
        items: [],
        status: 'unavailable',
        message: `Official state licensing board not accessed for this expert’s practice location${stateLabel}. This adapter completes an official Florida Department of Health (MQA) lookup only when the city is in Florida or NPPES lists a Florida license number. Licensing boards in other states were not queried. That is not a finding that the expert is unlicensed or that no discipline exists.`,
      };
    }

    const licenseNumber = reported[0]?.number;
    const lookup = await this.client.lookup({
      lastName: name.last,
      firstName: name.first,
      licenseNumber,
    });
    if (lookup.blocked) {
      return {
        items: [],
        status: 'error',
        outcome: 'restricted',
        message:
          lookup.message ??
          'The Florida Department of Health license lookup could not be read. Look the license up manually. This is not a finding that the license is invalid or that no discipline exists.',
      };
    }

    const ranked = lookup.hits
      .map((hit) => ({ hit, match: matchFloridaHit(hit, name, licenseNumber) }))
      .filter((entry) => entry.match !== 'none');

    if (this.kind === 'discipline') {
      return this.disciplineResult(ranked, name, licenseNumber, retrievedAt);
    }
    return this.licenseResult(ranked, name, licenseNumber, retrievedAt);
  }

  private licenseResult(
    ranked: Array<{ hit: FloridaLicenseHit; match: FloridaMatch }>,
    name: PersonName,
    licenseNumber: string | undefined,
    retrievedAt: string,
  ): LiveRunResult {
    if (ranked.length === 0) {
      return {
        items: [],
        status: 'no_result',
        message: [
          `The Florida Department of Health license lookup was searched for ${displayName(name)}`,
          licenseNumber ? ` and license ${licenseNumber}` : '',
          '. No matching license record was displayed. That is not proof that the license is invalid or that none exists.',
        ].join(''),
      };
    }
    const items = ranked.map(({ hit, match }) =>
      this.licenseItem(hit, name, match, retrievedAt),
    );
    const verified = ranked.filter(
      (entry) => entry.match === 'verified',
    ).length;
    return {
      items,
      message: [
        `Florida Department of Health lookup displayed ${ranked.length} matching license record(s)`,
        verified > 0 ? `; ${verified} matched name and license number` : '',
        '. Status and discipline are as shown on the official page on the retrieval date.',
      ].join(''),
    };
  }

  private disciplineResult(
    ranked: Array<{ hit: FloridaLicenseHit; match: FloridaMatch }>,
    name: PersonName,
    licenseNumber: string | undefined,
    retrievedAt: string,
  ): LiveRunResult {
    if (ranked.length === 0) {
      return {
        items: [],
        status: 'no_result',
        message: [
          `The Florida Department of Health license lookup was searched for ${displayName(name)}`,
          licenseNumber ? ` and license ${licenseNumber}` : '',
          '. No matching license record was displayed, so public discipline could not be checked. That is not proof that no discipline exists.',
        ].join(''),
      };
    }
    const flagged = ranked.filter(
      (entry) => entry.hit.disciplineOnFile === true,
    );
    if (flagged.length > 0) {
      return {
        items: flagged.map(({ hit, match }) =>
          this.disciplineItem(hit, name, match, retrievedAt),
        ),
        message: `The Florida Department of Health lookup displayed public discipline on file for ${flagged.length} matching license record(s). Read the official page for the action details.`,
      };
    }
    const unknown = ranked.every((entry) => entry.hit.disciplineOnFile == null);
    return {
      items: [],
      status: 'no_result',
      message: unknown
        ? 'The Florida Department of Health lookup matched a license but did not display a discipline field. That is not proof that no discipline exists.'
        : 'The Florida Department of Health lookup displayed no public discipline on file for the matching license. That is not proof that none exists; only what the page showed on the retrieval date is reported.',
    };
  }

  private async npiRecord(
    query: ExpertResearchQuery,
  ): Promise<NpiRecord | null> {
    try {
      const resolved = await this.resolver.resolve(query);
      return resolved.record;
    } catch {
      return null;
    }
  }

  private licenseItem(
    hit: FloridaLicenseHit,
    name: PersonName,
    match: FloridaMatch,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const verified = match === 'verified';
    return this.item({
      category: 'license',
      title: `Florida DOH license ${hit.licenseNumber}: ${hit.status || 'status not displayed'}`,
      summary: [
        `Official Florida Department of Health license lookup listed ${hit.name} as a ${hit.profession || 'health-care practitioner'}`,
        hit.status ? ` with status “${hit.status}”` : '',
        hit.city ? ` in ${hit.city}` : '',
        `. License ${hit.licenseNumber}.`,
        verified
          ? ' Name and license number matched the expert.'
          : ' This is a partial match; confirm it is the same person before relying on it.',
        ' This is official regulator data, not the self-reported NPPES license list.',
      ].join(''),
      url: hit.url,
      retrievedAt,
      informationStatus: verified ? 'verified' : 'unverified',
      raw: {
        identity: {
          name: displayName(name),
          city: hit.city ?? undefined,
          specialty: hit.profession || undefined,
          verifiedBy: verified ? 'source_match' : undefined,
          ambiguous: !verified,
          basis: verified
            ? ['name on official license record', 'license number']
            : ['partial name or license-number match'],
        },
        verificationStatus: verified
          ? 'official_verified'
          : 'official_partial_match',
        verificationSource: 'florida_doh_mqa',
        licenseNumber: hit.licenseNumber,
        licenseState: 'FL',
        profession: hit.profession || null,
        licenseStatus: hit.status || null,
        disciplineOnFile: hit.disciplineOnFile,
        displayedName: hit.name,
        city: hit.city,
        documentType: 'license',
        retrievedAt,
        sourceUrl: hit.url,
        searchUrl: FLORIDA_MQA_SEARCH,
        evidenceReference: `Florida DOH license ${hit.licenseNumber}`,
      },
    });
  }

  private disciplineItem(
    hit: FloridaLicenseHit,
    name: PersonName,
    match: FloridaMatch,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    return this.item({
      category: 'license',
      title: `Florida DOH discipline on file: license ${hit.licenseNumber}`,
      summary: [
        `The official Florida Department of Health lookup displayed discipline on file for license ${hit.licenseNumber} (${hit.name}).`,
        ' The action details were not copied beyond what the results page showed.',
        match === 'verified'
          ? ' Name and license number matched the expert.'
          : ' Confirm this is the same person before relying on it.',
      ].join(''),
      url: hit.url,
      retrievedAt,
      informationStatus: match === 'verified' ? 'verified' : 'unverified',
      raw: {
        identity: {
          name: displayName(name),
          verifiedBy: match === 'verified' ? 'source_match' : undefined,
          ambiguous: match !== 'verified',
        },
        verificationStatus:
          match === 'verified' ? 'official_verified' : 'official_partial_match',
        licenseNumber: hit.licenseNumber,
        licenseState: 'FL',
        licenseStatus: hit.status || null,
        disciplineOnFile: true,
        documentType: 'board_action',
        retrievedAt,
        sourceUrl: hit.url,
        evidenceReference: `Florida DOH license ${hit.licenseNumber} discipline flag`,
      },
    });
  }
}

export type FloridaMatch = 'verified' | 'partial' | 'none';

export function floridaLicensesFrom(
  record: NpiRecord | null | undefined,
): Array<{ state: string; number: string }> {
  if (!record) return [];
  return record.taxonomies
    .filter(
      (taxonomy) =>
        taxonomy.licenseState === 'FL' && Boolean(taxonomy.licenseNumber),
    )
    .map((taxonomy) => ({
      state: 'FL',
      number: taxonomy.licenseNumber!.replace(/\s+/g, '').toUpperCase(),
    }));
}

export function matchFloridaHit(
  hit: FloridaLicenseHit,
  name: PersonName,
  licenseNumber?: string,
): FloridaMatch {
  const parsed = parsePersonName(hit.name);
  const nameOk = Boolean(parsed && namesCompatible(parsed, name));
  const wanted = licenseNumber?.replace(/\s+/g, '').toUpperCase();
  const numberOk = Boolean(
    wanted && hit.licenseNumber.replace(/\s+/g, '').toUpperCase() === wanted,
  );
  if (nameOk && (numberOk || !wanted)) return 'verified';
  if (nameOk || numberOk) return 'partial';
  return 'none';
}
