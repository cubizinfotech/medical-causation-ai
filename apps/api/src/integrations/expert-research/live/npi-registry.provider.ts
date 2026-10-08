import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import type { ExpertIdentityResolver } from './identity-resolver';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import type { NpiRecord } from './npi-registry.client';
import { displayName } from './person-name';

/**
 * NPPES NPI Registry. Confirms who the expert is before other sources are
 * attributed to them, and lists the licenses the clinician reported.
 */
export class NpiRegistryResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly resolver: ExpertIdentityResolver,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    const { resolution, record } = await this.resolver.resolve(query);
    if (resolution.status !== 'confirmed' || !record) {
      return {
        items: [],
        status: 'no_result',
        outcome:
          resolution.status === 'npi_mismatch' ||
          resolution.status === 'ambiguous'
            ? 'conflicting'
            : 'no_result',
        message: resolution.note,
        identity: resolution,
      };
    }

    const identity = npiIdentity(record, query, resolution.basis);
    const items: ExpertEvidenceItem[] = [
      this.identityItem(record, identity, resolution.basis, retrievedAt),
    ];
    const licenses = this.licenseItem(record, identity, retrievedAt);
    if (licenses) items.push(licenses);
    return {
      items,
      message: [resolution.note, ...resolution.notes].join(' '),
      identity: resolution,
    };
  }

  private identityItem(
    record: NpiRecord,
    identity: Record<string, unknown>,
    basis: string[],
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const location = record.locations[0];
    const otherTaxonomies = record.taxonomies
      .map((taxonomy) => taxonomy.description)
      .filter((description) => description !== record.primaryTaxonomy);
    const summary = [
      `The NPI Registry lists ${record.displayName} as an individual clinician with NPI ${record.npi}.`,
      record.primaryTaxonomy
        ? `Primary taxonomy: ${record.primaryTaxonomy}.`
        : 'No taxonomy is listed.',
      otherTaxonomies.length > 0
        ? `Other taxonomies: ${[...new Set(otherTaxonomies)].join('; ')}.`
        : null,
      location
        ? `Practice location: ${[location.line, location.city, location.state].filter(Boolean).join(', ')}.`
        : 'No practice location is listed.',
      record.enumerationDate
        ? `NPI issued ${record.enumerationDate}${record.lastUpdated ? `; record last updated ${record.lastUpdated}` : ''}.`
        : null,
      `Matched on: ${basis.join(', ')}.`,
      'Taxonomy is chosen by the clinician and is not board certification.',
    ]
      .filter(Boolean)
      .join(' ');
    return this.item({
      category: 'identity',
      title: `NPI Registry: ${record.displayName} (NPI ${record.npi})`,
      summary,
      url: record.url,
      retrievedAt,
      informationStatus: 'verified',
      raw: {
        identity,
        npi: record.npi,
        credential: record.credential,
        primaryTaxonomy: record.primaryTaxonomy,
        taxonomies: record.taxonomies.map((taxonomy) => ({
          code: taxonomy.code,
          description: taxonomy.description,
          primary: taxonomy.primary,
        })),
        practiceLocation: location ?? null,
        enumerationDate: record.enumerationDate,
        lastUpdated: record.lastUpdated,
        registryStatus: record.status === 'A' ? 'active' : record.status,
        matchBasis: basis,
        evidenceReference: `NPI Registry record ${record.npi}`,
      },
    });
  }

  private licenseItem(
    record: NpiRecord,
    identity: Record<string, unknown>,
    retrievedAt: string,
  ): ExpertEvidenceItem | null {
    const licenses = record.taxonomies
      .filter((taxonomy) => taxonomy.licenseState || taxonomy.licenseNumber)
      .map((taxonomy) => ({
        state: taxonomy.licenseState,
        number: taxonomy.licenseNumber,
        taxonomy: taxonomy.description,
        primary: taxonomy.primary,
      }));
    const unique = licenses.filter(
      (license, index) =>
        licenses.findIndex(
          (other) =>
            other.state === license.state && other.number === license.number,
        ) === index,
    );
    if (unique.length === 0) return null;
    const list = unique
      .map(
        (license) =>
          `${license.state ?? 'State not listed'} ${license.number ?? '(number not listed)'}${license.primary ? ' (primary)' : ''}`,
      )
      .join('; ');
    return this.item({
      category: 'license',
      title: `Licenses reported to the NPI Registry (NPI ${record.npi})`,
      summary: `${list}. These licenses were reported by the clinician to NPPES, which does not verify them. Confirm each license with the state medical board.`,
      url: record.url,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        identity,
        npi: record.npi,
        nppesLicenses: unique,
        verificationNote: 'Self-reported to NPPES. Not a license verification.',
        evidenceReference: `NPI Registry record ${record.npi}`,
      },
    });
  }
}

/** Identity hints for items that came from the confirmed NPI record. */
export function npiIdentity(
  record: NpiRecord,
  query: ExpertResearchQuery,
  basis: string[],
): Record<string, unknown> {
  const location = record.locations[0];
  return {
    name: record.names[0] ? displayName(record.names[0]) : query.expertName,
    city: location?.city ?? query.city,
    specialty: record.primaryTaxonomy ?? query.specialty,
    verifiedBy: 'npi',
    npi: record.npi,
    basis,
  };
}
