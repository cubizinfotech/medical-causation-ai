import { fetchJson, LiveHttpError } from './live-http';
import {
  classifyPublicationType,
  mapCatalogType,
  normalizeDoi,
  parsePmid,
  parseYear,
  type ScholarlyType,
} from './publication-citation';

export const ORCID_TOKEN_URL = 'https://orcid.org/oauth/token';
export const ORCID_PUBLIC_API = 'https://pub.orcid.org/v3.0';

const ORCID_ID = /\b(0000-\d{4}-\d{4}-\d{3}[\dX])\b/i;

export interface OrcidClientOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  publicApiBase?: string;
}

export interface OrcidSearchHit {
  orcid: string;
  givenNames: string;
  familyNames: string;
  creditName: string | null;
  otherNames: string[];
  institutions: string[];
}

export interface OrcidWork {
  putCode: string | null;
  title: string;
  url: string;
  year: number | null;
  doi?: string;
  pmid?: string;
  type?: ScholarlyType;
  journal?: string;
  /** Contributor names when ORCID listed them. Often empty on public summaries. */
  authors: string[];
}

export interface OrcidRecord {
  orcid: string;
  url: string;
  givenNames: string;
  familyNames: string;
  creditName: string | null;
  otherNames: string[];
  keywords: string[];
  employments: string[];
  educations: string[];
  works: OrcidWork[];
}

/**
 * ORCID Public API v3.0. Search and record reads use a client-credentials
 * /read-public token. Private visibility items are not requested.
 */
export class OrcidClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly options: OrcidClientOptions) {}

  configured(): boolean {
    return Boolean(
      this.options.clientId?.trim() && this.options.clientSecret?.trim(),
    );
  }

  async expandedSearch(
    query: string,
    rows = 8,
  ): Promise<{ numFound: number; hits: OrcidSearchHit[] }> {
    const url = new URL(
      `${this.options.publicApiBase ?? ORCID_PUBLIC_API}/expanded-search/`,
    );
    url.searchParams.set('q', query);
    url.searchParams.set('rows', String(Math.min(Math.max(rows, 1), 25)));
    url.searchParams.set('start', '0');
    const payload = await this.apiGet<Record<string, unknown>>(url);
    const hits = asArray(payload['expanded-result'] ?? payload.expandedResult)
      .map(parseSearchHit)
      .filter((hit): hit is OrcidSearchHit => Boolean(hit));
    const numFound = Number(
      payload['num-found'] ?? payload.numFound ?? hits.length,
    );
    return {
      numFound: Number.isFinite(numFound) ? numFound : hits.length,
      hits,
    };
  }

  async record(orcid: string): Promise<OrcidRecord | null> {
    const id = parseOrcidId(orcid);
    if (!id) return null;
    const url = new URL(
      `${this.options.publicApiBase ?? ORCID_PUBLIC_API}/${id}/record`,
    );
    const payload = await this.apiGet<Record<string, unknown>>(url);
    return parseRecord(id, payload);
  }

  /**
   * Finds public records that list this DOI on a work, optionally narrowed
   * by family name so a shared paper does not pull in every co-author.
   */
  async searchByDoi(
    doi: string,
    familyName?: string,
  ): Promise<OrcidSearchHit[]> {
    const normalized = normalizeDoi(doi);
    if (!normalized) return [];
    return this.searchByIdentifier('doi-self', normalized, familyName);
  }

  async searchByPmid(
    pmid: string,
    familyName?: string,
  ): Promise<OrcidSearchHit[]> {
    const id = parsePmid(pmid);
    if (!id) return [];
    return this.searchByIdentifier('pmid', id, familyName);
  }

  private async searchByIdentifier(
    field: string,
    value: string,
    familyName?: string,
  ): Promise<OrcidSearchHit[]> {
    const parts = [`${field}:"${escapeSolr(value)}"`];
    if (familyName) parts.push(`family-name:${escapeSolr(familyName)}`);
    const { hits } = await this.expandedSearch(parts.join(' AND '), 8);
    return hits;
  }

  private async apiGet<T>(url: URL): Promise<T> {
    const token = await this.accessToken();
    return fetchJson<T>(url, {
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
      headers: {
        Accept: 'application/vnd.orcid+json',
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private async accessToken(): Promise<string> {
    if (!this.configured()) {
      throw new LiveHttpError('ORCID is not configured (no API key).', 'auth');
    }
    const now = Date.now();
    if (this.token && this.token.expiresAt > now + 60_000) {
      return this.token.value;
    }
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const body = new URLSearchParams({
      client_id: this.options.clientId!.trim(),
      client_secret: this.options.clientSecret!.trim(),
      grant_type: 'client_credentials',
      scope: '/read-public',
    });
    let response: Response;
    try {
      response = await fetchImpl(this.options.tokenUrl ?? ORCID_TOKEN_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new LiveHttpError(
        timedOut ? 'The source timed out.' : 'The source could not be reached.',
        timedOut ? 'timeout' : 'network',
      );
    }
    if (response.status === 429) {
      throw new LiveHttpError(
        'The source rate limited the request (HTTP 429).',
        'rate_limited',
        429,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new LiveHttpError(
        'ORCID rejected the client credentials.',
        'auth',
        response.status,
      );
    }
    if (!response.ok) {
      throw new LiveHttpError(
        `The source returned HTTP ${response.status}.`,
        'http',
        response.status,
      );
    }
    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!payload.access_token) {
      throw new LiveHttpError('ORCID did not return an access token.', 'auth');
    }
    const lifetime = Number(payload.expires_in);
    this.token = {
      value: payload.access_token,
      expiresAt:
        now +
        (Number.isFinite(lifetime) && lifetime > 0
          ? lifetime * 1000
          : 24 * 60 * 60 * 1000),
    };
    return this.token.value;
  }
}

/** Hyphenated ORCID iD from free text or a profile URL. */
export function parseOrcidId(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(ORCID_ID);
  return match ? match[1].toUpperCase() : null;
}

export function orcidProfileUrl(orcid: string): string {
  return `https://orcid.org/${orcid}`;
}

export function escapeSolr(value: string): string {
  return value
    .replace(/[+"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSearchHit(raw: unknown): OrcidSearchHit | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const orcid = parseOrcidId(text(row['orcid-id'] ?? row.orcidId ?? row.orcid));
  if (!orcid) return null;
  return {
    orcid,
    givenNames: text(row['given-names'] ?? row.givenNames) ?? '',
    familyNames: text(row['family-names'] ?? row.familyNames) ?? '',
    creditName: text(row['credit-name'] ?? row.creditName),
    otherNames: stringList(row['other-name'] ?? row.otherName),
    institutions: stringList(row['institution-name'] ?? row.institutionName),
  };
}

function parseRecord(
  orcid: string,
  payload: Record<string, unknown>,
): OrcidRecord {
  const person = object(payload.person);
  const name = object(person.name);
  const activities = object(
    payload['activities-summary'] ?? payload.activitiesSummary,
  );
  return {
    orcid,
    url: orcidProfileUrl(orcid),
    givenNames: nestedValue(name['given-names'] ?? name.givenNames) ?? '',
    familyNames: nestedValue(name['family-name'] ?? name.familyName) ?? '',
    creditName: nestedValue(name['credit-name'] ?? name.creditName),
    otherNames: collectNamed(
      object(person['other-names'] ?? person.otherNames)['other-name'] ??
        object(person['other-names'] ?? person.otherNames).otherName,
      ['content', 'value'],
    ),
    keywords: collectNamed(object(person.keywords).keyword, [
      'content',
      'value',
    ]),
    employments: affiliationNames(
      object(activities.employments)['affiliation-group'] ??
        object(activities.employments).affiliationGroup,
      'employment-summary',
    ),
    educations: affiliationNames(
      object(activities.educations)['affiliation-group'] ??
        object(activities.educations).affiliationGroup,
      'education-summary',
    ),
    works: parseWorks(object(activities.works).group, orcid),
  };
}

function parseWorks(raw: unknown, orcid: string): OrcidWork[] {
  const works: OrcidWork[] = [];
  const seen = new Set<string>();
  for (const group of asArray(raw)) {
    const summaries = asArray(
      object(group)['work-summary'] ?? object(group).workSummary,
    );
    for (const summary of summaries) {
      const work = parseWorkSummary(summary, orcid);
      if (!work) continue;
      const key = work.doi ?? work.pmid ?? work.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      works.push(work);
    }
  }
  return works;
}

function parseWorkSummary(raw: unknown, orcid: string): OrcidWork | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const titleObj = object(object(row.title).title);
  const title = text(titleObj.value) ?? text(row.title);
  if (!title) return null;
  const ids = asArray(
    object(row['external-ids'] ?? row.externalIds)['external-id'] ??
      object(row['external-ids'] ?? row.externalIds).externalId,
  );
  let doi: string | undefined;
  let pmid: string | undefined;
  for (const entry of ids) {
    const id = object(entry);
    const type = (
      text(id['external-id-type'] ?? id.externalIdType) ?? ''
    ).toLowerCase();
    const value = text(id['external-id-value'] ?? id.externalIdValue);
    if (!value) continue;
    if (type === 'doi') doi = normalizeDoi(value) ?? doi;
    if (type === 'pmid') pmid = parsePmid(value) ?? pmid;
  }
  const year = parseYear(
    nestedValue(
      object(object(row['publication-date'] ?? row.publicationDate).year).value,
    ) ??
      nestedValue(
        object(row['publication-date'] ?? row.publicationDate).year,
      ) ??
      undefined,
  );
  const journal = nestedValue(
    object(object(row['journal-title'] ?? row.journalTitle).value).value ??
      object(row['journal-title'] ?? row.journalTitle).value,
  );
  const typeText = text(row.type) ?? '';
  const url =
    nestedValue(object(row.url).value) ??
    (doi ? `https://doi.org/${doi}` : orcidProfileUrl(orcid));
  const putCodeRaw = row['put-code'] ?? row.putCode;
  const putCode =
    typeof putCodeRaw === 'string' || typeof putCodeRaw === 'number'
      ? String(putCodeRaw)
      : null;
  const authors = contributorNames(
    object(row.contributors).contributor ?? row.contributors,
  );
  return {
    putCode,
    title,
    url,
    year,
    doi,
    pmid,
    journal: journal ?? undefined,
    type:
      mapCatalogType(typeText) ?? classifyPublicationType(typeText || title),
    authors,
  };
}

function contributorNames(raw: unknown): string[] {
  return asArray(raw)
    .map((entry) => {
      const row = object(entry);
      const credit = object(row['credit-name'] ?? row.creditName);
      return text(credit.value) ?? text(row['credit-name'] ?? row.creditName);
    })
    .filter((name): name is string => Boolean(name));
}

function affiliationNames(groups: unknown, summaryKey: string): string[] {
  const names: string[] = [];
  for (const group of asArray(groups)) {
    const summaries = asArray(object(group).summaries);
    const rows =
      summaries.length > 0
        ? summaries.flatMap((summary) =>
            asArray(
              object(summary)[summaryKey] ?? object(summary)[camel(summaryKey)],
            ),
          )
        : asArray(
            object(group)[summaryKey] ?? object(group)[camel(summaryKey)],
          );
    for (const row of rows) {
      const org = object(object(row).organization).name;
      const name = text(org) ?? nestedValue(org);
      if (name) names.push(name);
    }
  }
  return [...new Set(names)];
}

function collectNamed(raw: unknown, keys: string[]): string[] {
  return asArray(raw)
    .map((entry) => {
      const row = object(entry);
      for (const key of keys) {
        const value = text(row[key]);
        if (value) return value;
      }
      return text(entry);
    })
    .filter((value): value is string => Boolean(value));
}

function nestedValue(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return text((raw as Record<string, unknown>).value);
  }
  return null;
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function stringList(value: unknown): string[] {
  return asArray(value)
    .map((entry) => text(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function camel(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}
