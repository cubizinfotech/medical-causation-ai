import { fetchJson } from './live-http';

export const OPEN_PAYMENTS_API = 'https://openpaymentsdata.cms.gov/api/1';
export const OPEN_PAYMENTS_SITE = 'https://openpaymentsdata.cms.gov';

const PAYER = 'applicable_manufacturer_or_applicable_gpo_making_payment_name';
const NATURE = 'nature_of_payment_or_transfer_of_value';
const AMOUNT = 'total_amount_of_payment_usdollars';
const PROFILE = 'covered_recipient_profile_id';
const RECIPIENT_TYPE = 'covered_recipient_type';
const PAGE_SIZE = 500;
const MAX_ROWS = 2500;
const DATASET_TTL_MS = 24 * 60 * 60 * 1000;

export interface GeneralPaymentDataset {
  year: number;
  datasetId: string;
}

/** One payer and nature of payment in one program year, summed by CMS. */
export interface PaymentGroup {
  year: number;
  payer: string;
  nature: string;
  /** Exact total in cents. */
  cents: number;
  records: number;
  profileId: string | null;
  recipientType: string | null;
}

interface DatasetItem {
  identifier?: string;
  title?: string;
}

interface QueryResponse {
  results?: Array<Record<string, string | null>>;
  count?: number;
}

export interface OpenPaymentsClientOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  now?: () => number;
}

/** Public CMS Open Payments datastore (DKAN). No key is required. */
export class OpenPaymentsClient {
  private datasets: {
    storedAt: number;
    value: Promise<GeneralPaymentDataset[]>;
  } | null = null;

  constructor(private readonly options: OpenPaymentsClientOptions) {}

  /** "General Payment Data" datasets, newest program year first. */
  generalPaymentDatasets(): Promise<GeneralPaymentDataset[]> {
    const now = (this.options.now ?? Date.now)();
    if (this.datasets && now - this.datasets.storedAt < DATASET_TTL_MS) {
      return this.datasets.value;
    }
    const value = fetchJson<DatasetItem[]>(
      `${this.baseUrl}/metastore/schemas/dataset/items`,
      { timeoutMs: this.options.timeoutMs, fetchImpl: this.options.fetchImpl },
    ).then((items) =>
      items
        .flatMap((item) => {
          const match = item.title?.match(/^(\d{4}) General Payment Data$/i);
          return match && item.identifier
            ? [{ year: Number(match[1]), datasetId: item.identifier }]
            : [];
        })
        .sort((left, right) => right.year - left.year),
    );
    this.datasets = { storedAt: now, value };
    value.catch(() => {
      if (this.datasets?.value === value) this.datasets = null;
    });
    return value;
  }

  /**
   * Payments to one NPI in one program year, summed by CMS per payer and
   * nature of payment. Totals are computed by the datastore, not sampled.
   */
  async paymentGroups(
    dataset: GeneralPaymentDataset,
    npi: string,
  ): Promise<PaymentGroup[]> {
    const groups: PaymentGroup[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const body = await fetchJson<QueryResponse>(
        `${this.baseUrl}/datastore/query/${dataset.datasetId}/0`,
        {
          method: 'POST',
          timeoutMs: this.options.timeoutMs,
          fetchImpl: this.options.fetchImpl,
          body: {
            properties: [
              PAYER,
              NATURE,
              PROFILE,
              RECIPIENT_TYPE,
              {
                expression: { operator: 'sum', operands: [AMOUNT] },
                alias: 'total',
              },
              {
                expression: { operator: 'count', operands: ['record_id'] },
                alias: 'records',
              },
            ],
            conditions: [
              { property: 'covered_recipient_npi', value: npi, operator: '=' },
            ],
            groupings: [PAYER, NATURE, PROFILE, RECIPIENT_TYPE],
            sorts: [{ property: 'total', order: 'desc' }],
            limit: PAGE_SIZE,
            offset,
            count: true,
            results: true,
            schema: false,
          },
        },
      );
      const rows = body.results ?? [];
      for (const row of rows) {
        groups.push({
          year: dataset.year,
          payer: row[PAYER]?.trim() || 'Payer not stated',
          nature: row[NATURE]?.trim() || 'Nature not stated',
          cents: Math.round(Number(row.total ?? 0) * 100),
          records: Number(row.records ?? 0),
          profileId: row[PROFILE]?.trim() || null,
          recipientType: row[RECIPIENT_TYPE]?.trim() || null,
        });
      }
      if (rows.length < PAGE_SIZE || offset + PAGE_SIZE >= (body.count ?? 0)) {
        break;
      }
    }
    return groups;
  }

  private get baseUrl(): string {
    return (this.options.baseUrl ?? OPEN_PAYMENTS_API).replace(/\/$/, '');
  }
}

/** Public profile page for a covered recipient. */
export function openPaymentsProfileUrl(
  profileId: string | null,
  recipientType: string | null,
): string | null {
  if (!profileId) return null;
  const nonPhysician = /non-physician/i.test(recipientType ?? '');
  return `${OPEN_PAYMENTS_SITE}/${nonPhysician ? 'npp' : 'physician'}/${profileId}`;
}
