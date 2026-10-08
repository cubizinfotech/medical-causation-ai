import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import type { ExpertIdentityResolver } from './identity-resolver';
import {
  formatUsd,
  LiveResearchProvider,
  mapWithLimit,
  type LiveRunResult,
} from './live-provider.base';
import { npiIdentity } from './npi-registry.provider';
import {
  OPEN_PAYMENTS_SITE,
  openPaymentsProfileUrl,
  type OpenPaymentsClient,
  type PaymentGroup,
} from './open-payments.client';

const TOP_PAYERS = 8;

const SCOPE_NOTE =
  'Open Payments lists payments and other transfers of value that drug and device makers reported to CMS. It does not include legal or expert-witness fees. Being paid is not proof of bias.';

interface Totals {
  cents: number;
  records: number;
}

/**
 * CMS Open Payments general payments, searched only by the confirmed NPI so
 * payments are never attributed to someone with the same name.
 */
export class OpenPaymentsResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly resolver: ExpertIdentityResolver,
    private readonly client: OpenPaymentsClient,
    private readonly years: number,
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
        status: 'unavailable',
        message: `Not searched. Open Payments is searched only by a confirmed NPI so payments are never attributed to the wrong person. ${resolution.note}`,
      };
    }

    const datasets = (await this.client.generalPaymentDatasets()).slice(
      0,
      Math.max(1, this.years),
    );
    if (datasets.length === 0) {
      return {
        items: [],
        status: 'unavailable',
        outcome: 'api_failure',
        message:
          'Open Payments did not list any General Payment datasets. Nothing was inferred.',
      };
    }
    const groups = samePayerNames(
      (
        await mapWithLimit(datasets, 3, (dataset) =>
          this.client.paymentGroups(dataset, record.npi),
        )
      ).flat(),
    );
    const years = datasets.map((dataset) => dataset.year).sort();
    const span = `${years[0]}–${years[years.length - 1]}`;
    if (groups.length === 0) {
      return {
        items: [],
        message: `No general payments were reported for NPI ${record.npi} in program years ${span}. ${SCOPE_NOTE}`,
      };
    }

    const identity = npiIdentity(record, query, resolution.basis);
    const profile = groups.find((group) => group.profileId);
    const url =
      openPaymentsProfileUrl(
        profile?.profileId ?? null,
        profile?.recipientType ?? null,
      ) ?? OPEN_PAYMENTS_SITE;
    const items: ExpertEvidenceItem[] = [
      this.summaryItem(
        groups,
        years,
        span,
        record.npi,
        identity,
        url,
        retrievedAt,
      ),
      ...this.payerItems(groups, record.npi, identity, url, retrievedAt),
    ];
    const total = sum(groups);
    return {
      items,
      message: `${formatUsd(total.cents / 100)} in ${total.records} general payment record(s) from ${countBy(groups, (group) => group.payer).size} company(ies) for NPI ${record.npi}, program years ${span}.`,
    };
  }

  private summaryItem(
    groups: PaymentGroup[],
    years: number[],
    span: string,
    npi: string,
    identity: Record<string, unknown>,
    url: string,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const total = sum(groups);
    const payers = countBy(groups, (group) => group.payer);
    const byYear = years
      .slice()
      .reverse()
      .map((year) => {
        const totals = sum(groups.filter((group) => group.year === year));
        return { year, total: totals.cents / 100, records: totals.records };
      });
    const byNature = [...countBy(groups, (group) => group.nature).entries()]
      .map(([nature, totals]) => ({
        nature,
        total: totals.cents / 100,
        records: totals.records,
      }))
      .sort((left, right) => right.total - left.total);
    const topPayers = [...payers.entries()]
      .map(([payer, totals]) => ({
        payer,
        total: totals.cents / 100,
        records: totals.records,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, TOP_PAYERS);
    const quiet = byYear
      .filter((row) => row.records === 0)
      .map((row) => row.year);
    const companies = `${payers.size} ${payers.size === 1 ? 'company' : 'companies'}`;
    const summary = [
      `${total.records} general payment record(s) totaling ${formatUsd(total.cents / 100)} from ${companies} were reported for NPI ${npi} in program years ${span}.`,
      `By year: ${byYear
        .filter((row) => row.records > 0)
        .map((row) => `${row.year} ${formatUsd(row.total)}`)
        .join('; ')}.`,
      quiet.length > 0 ? `No payments reported in ${quiet.join(', ')}.` : null,
      `Largest categories: ${byNature
        .slice(0, 4)
        .map((row) => `${row.nature} ${formatUsd(row.total)}`)
        .join('; ')}.`,
      SCOPE_NOTE,
    ]
      .filter(Boolean)
      .join(' ');
    return this.item({
      category: 'income_bias',
      title: `CMS Open Payments ${span}: ${formatUsd(total.cents / 100)} from ${companies}`,
      summary,
      url,
      retrievedAt,
      informationStatus: 'verified',
      raw: {
        identity,
        npi,
        professionalKind: 'open_payments',
        paymentAmount: formatUsd(total.cents / 100),
        payer: companies,
        natureOfPayment: byNature
          .slice(0, 6)
          .map((row) => `${row.nature} ${formatUsd(row.total)}`)
          .join('; '),
        date: String(years[0]),
        openPaymentsSummary: true,
        programYears: years,
        totalAmount: total.cents / 100,
        recordCount: total.records,
        payerCount: payers.size,
        byYear,
        byNature,
        topPayers,
        neutralSummary: SCOPE_NOTE,
        evidenceReference: `CMS Open Payments general payments, program years ${span}, NPI ${npi}`,
      },
    });
  }

  private payerItems(
    groups: PaymentGroup[],
    npi: string,
    identity: Record<string, unknown>,
    url: string,
    retrievedAt: string,
  ): ExpertEvidenceItem[] {
    const payers = [...countBy(groups, (group) => group.payer).entries()]
      .sort((left, right) => right[1].cents - left[1].cents)
      .slice(0, TOP_PAYERS);
    return payers.map(([payer, totals]) => {
      const own = groups.filter((group) => group.payer === payer);
      const years = [...new Set(own.map((group) => group.year))].sort();
      const natures = [...countBy(own, (group) => group.nature).entries()]
        .sort((left, right) => right[1].cents - left[1].cents)
        .map(
          ([nature, value]) =>
            `${nature} ${formatUsd(value.cents / 100)} (${value.records})`,
        );
      const yearText =
        years.length === 1
          ? String(years[0])
          : `${years[0]}–${years[years.length - 1]}`;
      return this.item({
        category: 'income_bias',
        title: `Open Payments: ${payer} — ${formatUsd(totals.cents / 100)} (${yearText})`,
        summary: `${totals.records} payment record(s) from ${payer} in program year(s) ${years.join(', ')}: ${natures.join('; ')}.`,
        url,
        retrievedAt,
        informationStatus: 'verified',
        raw: {
          identity,
          npi,
          professionalKind: 'open_payments',
          payer,
          paymentAmount: formatUsd(totals.cents / 100),
          natureOfPayment: natures.join('; '),
          date: String(years[0]),
          programYears: years,
          totalAmount: totals.cents / 100,
          recordCount: totals.records,
          neutralSummary: SCOPE_NOTE,
          evidenceReference: `CMS Open Payments general payments from ${payer}, NPI ${npi}`,
        },
      });
    });
  }
}

/**
 * CMS spells one company differently across years ("ABBVIE INC." and
 * "AbbVie Inc."). Names that differ only in case and punctuation are one
 * company, shown under the spelling with the most money.
 */
function samePayerNames(groups: PaymentGroup[]): PaymentGroup[] {
  const key = (payer: string) => payer.toLowerCase().replace(/[^a-z0-9]/g, '');
  const spellings = new Map<string, Map<string, number>>();
  for (const group of groups) {
    const byName = spellings.get(key(group.payer)) ?? new Map<string, number>();
    byName.set(group.payer, (byName.get(group.payer) ?? 0) + group.cents);
    spellings.set(key(group.payer), byName);
  }
  const display = new Map(
    [...spellings.entries()].map(([payerKey, byName]) => [
      payerKey,
      [...byName.entries()].sort((left, right) => right[1] - left[1])[0][0],
    ]),
  );
  return groups.map((group) => ({
    ...group,
    payer: display.get(key(group.payer)) ?? group.payer,
  }));
}

function sum(groups: PaymentGroup[]): Totals {
  return groups.reduce(
    (totals, group) => ({
      cents: totals.cents + group.cents,
      records: totals.records + group.records,
    }),
    { cents: 0, records: 0 },
  );
}

function countBy(
  groups: PaymentGroup[],
  key: (group: PaymentGroup) => string,
): Map<string, Totals> {
  const totals = new Map<string, Totals>();
  for (const group of groups) {
    const name = key(group);
    const current = totals.get(name) ?? { cents: 0, records: 0 };
    totals.set(name, {
      cents: current.cents + group.cents,
      records: current.records + group.records,
    });
  }
  return totals;
}
