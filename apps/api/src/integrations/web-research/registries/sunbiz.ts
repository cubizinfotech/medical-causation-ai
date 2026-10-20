import { parseCityState, stateCode } from '../../expert-research/live/location';
import { professionTerms, type IdentitySubject } from '../identity-assess';
import { decodeHtmlEntities } from '../page-text';
import type { SafeFetcher } from '../safe-fetcher';
import type { SearchHit, WebResearchDossier } from '../web-research.types';

const BASE = 'https://search.sunbiz.org';

export interface RegistryResult {
  hits: SearchHit[];
  report: WebResearchDossier['registries'][number];
}

interface ResultRow {
  name: string;
  url: string;
  rowText: string;
}

/** Rows of a Sunbiz result table: a link to a detail page plus its cells. */
export function parseSunbizRows(html: string): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const link = tr.match(
      /<a[^>]+href="([^"]*SearchResultDetail[^"]*)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!link) continue;
    const name = decodeHtmlEntities(link[2].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    const rowText = decodeHtmlEntities(tr.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    let url: string;
    try {
      url = new URL(decodeHtmlEntities(link[1]), BASE).toString();
    } catch {
      continue;
    }
    if (name) rows.push({ name, url, rowText });
  }
  return rows;
}

/** Summary lines from a Sunbiz entity page's text, when the layout is recognised. */
export function summarizeSunbizDetail(text: string): string | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const after = (label: RegExp, take = 1): string[] => {
    const index = lines.findIndex((l) => label.test(l));
    return index < 0 ? [] : lines.slice(index + 1, index + 1 + take);
  };
  const entityIndex = lines.findIndex((l) => /^detail by entity name/i.test(l));
  const entityName =
    entityIndex >= 0
      ? lines
          .slice(entityIndex + 1, entityIndex + 4)
          .find(
            (l) =>
              !/^florida|^foreign|^domestic|limited|corporation$|company$/i.test(
                l,
              ) || /\b(LLC|INC|P\.?A\.?|PLLC|CORP)\b/i.test(l),
          )
      : undefined;
  const documentNumber = after(/^document number$/i)[0];
  const status = after(/^status$/i)[0];
  const filed = after(/^date filed$/i)[0];
  const principal = after(/^principal address$/i, 3).join(', ');
  const agent = after(/^registered agent name & address$/i, 3).join(', ');
  const officers: string[] = [];
  const officerIndex = lines.findIndex((l) =>
    /^officer\/director detail/i.test(l),
  );
  if (officerIndex >= 0) {
    for (let i = officerIndex + 1; i < lines.length - 1; i++) {
      const title = lines[i].match(/^Title\s+(.+)$/i);
      if (title) {
        const name = lines[i + 1];
        if (name && !/^Annual Reports/i.test(name))
          officers.push(`${title[1]}: ${name}`);
      }
      if (/^annual reports/i.test(lines[i])) break;
    }
  }
  const parts = [
    entityName ? `Entity: ${entityName}` : null,
    documentNumber ? `Document number ${documentNumber}` : null,
    status ? `status ${status}` : null,
    filed ? `filed ${filed}` : null,
    principal ? `Principal address: ${principal}` : null,
    agent ? `Registered agent: ${agent}` : null,
    officers.length > 0
      ? `Officers/directors: ${officers.slice(0, 6).join('; ')}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('. ') + '.' : null;
}

const COMPANY_PATTERN =
  /\b([A-Z][\p{L}&'.-]*(?:[ ,]+(?:[A-Z&][\p{L}&'.-]*|of|and|the)){0,5}?),?\s+(LLC|L\.L\.C\.|Inc\.?|Incorporated|P\.A\.|PLLC|P\.L\.L\.C\.|Corp\.?|Corporation|LLP|Ltd\.?|P\.C\.)(?![\p{L}])/gu;

const LEADING_NOISE =
  /^(?:(?:The|At|By|For|With|Of|And|In|From|Our|Welcome|Contact|About|Copyright|©)\s+)+/i;

function normalizeCompany(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(
      /\b(llc|inc|incorporated|pa|pllc|corp|corporation|llp|ltd|pc)\b/g,
      '',
    )
    .replace(/[^a-z0-9& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Business names (LLC, P.A., Inc ...) that a page ties to the subject: written
 * within a few hundred characters of the surname, or matching the site's own
 * address ("neuropsychologicalsciences.com" and "Neuropsychological Sciences, LLC").
 */
export function companyNamesNearSubject(
  text: string,
  surname: string,
  host: string,
): string[] {
  const lower = text.toLowerCase();
  const surnameLower = surname.toLowerCase();
  const hostKey = host
    .toLowerCase()
    .replace(/^www\./, '')
    .split('.')[0]
    .replace(/[^a-z0-9]/g, '');
  const counts = new Map<string, { name: string; count: number }>();
  for (const match of text.matchAll(COMPANY_PATTERN)) {
    const raw =
      `${match[1].replace(LEADING_NOISE, '').trim()}, ${match[2]}`.replace(
        /,\s*,/g,
        ',',
      );
    const base = normalizeCompany(raw);
    if (base.length < 4 || raw.length > 70) continue;
    const index = match.index ?? 0;
    const around = lower.slice(
      Math.max(0, index - 500),
      index + raw.length + 500,
    );
    const nearSurname = around.includes(surnameLower);
    const ownSite =
      hostKey.length >= 6 &&
      base
        .replace(/[^a-z0-9]/g, '')
        .includes(hostKey.slice(0, Math.min(hostKey.length, 12)));
    if (!nearSurname && !ownSite) continue;
    const entry = counts.get(base) ?? { name: raw, count: 0 };
    entry.count += 1;
    counts.set(base, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((entry) => entry.name);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Looks the named businesses up by entity name on Sunbiz. */
export async function discoverSunbizCompanies(
  companies: string[],
  fetcher: SafeFetcher,
  options: { maxPerCompany?: number } = {},
): Promise<RegistryResult> {
  const hits: SearchHit[] = [];
  const notes: string[] = [];
  let checked = 0;
  for (const company of companies) {
    await sleep(1200);
    const term = company.replace(
      /,?\s+(LLC|L\.L\.C\.|Inc\.?|Incorporated|P\.A\.|PLLC|P\.L\.L\.C\.|Corp\.?|Corporation|LLP|Ltd\.?|P\.C\.)$/i,
      '',
    );
    const url = `${BASE}/Inquiry/CorporationSearch/SearchResults/EntityName/${encodeURIComponent(term)}/Page1`;
    const page = await fetcher.fetchPage(url, { keepHtml: true });
    if (page.status !== 'read' || !page.html) {
      notes.push(`"${company}": ${page.note ?? 'no readable result'}`);
      continue;
    }
    checked += 1;
    const wanted = normalizeCompany(company);
    const rows = parseSunbizRows(page.html).filter((row) => {
      const found = normalizeCompany(row.name);
      return (
        found === wanted || found.startsWith(wanted) || wanted.startsWith(found)
      );
    });
    for (const row of rows.slice(0, options.maxPerCompany ?? 2)) {
      if (hits.some((h) => h.url === row.url)) continue;
      hits.push({
        url: row.url,
        title: `Sunbiz: ${row.name}`,
        snippet: row.rowText.slice(0, 300),
        providerId: 'sunbiz',
        query: `Sunbiz entity name: ${company}`,
        kind: 'web',
      });
    }
    if (rows.length === 0)
      notes.push(`"${company}": no Florida entity with that name.`);
  }
  return {
    hits,
    report: {
      id: 'sunbiz_companies',
      name: 'Florida Division of Corporations (Sunbiz), businesses named on the subject’s pages',
      status: checked > 0 ? 'checked' : 'failed',
      message:
        companies.length === 0
          ? 'No business name was found on the pages read.'
          : `Searched Sunbiz for ${companies.map((c) => `"${c}"`).join(', ')}: ${hits.length} matching entit${hits.length === 1 ? 'y' : 'ies'}.${notes.length > 0 ? ` ${notes.join(' ')}` : ''}`,
      url: `${BASE}/Inquiry/CorporationSearch/ByName`,
    },
  };
}

/**
 * Florida Division of Corporations (Sunbiz): officer and registered-agent
 * search by name, plus entity names that contain the surname and a first name
 * or profession word. Returns detail-page URLs for the engine to read.
 */
export async function discoverSunbiz(
  subject: IdentitySubject,
  fetcher: SafeFetcher,
  options: { maxDetailPages?: number } = {},
): Promise<RegistryResult> {
  const { state } = parseCityState(subject.city || '');
  const code = state ?? stateCode(subject.city || '');
  if (code && code !== 'FL') {
    return {
      hits: [],
      report: {
        id: 'sunbiz',
        name: 'Florida Division of Corporations (Sunbiz)',
        status: 'not_applicable',
        message: `Not searched: the subject's location is in ${code}, not Florida. Other states' registries are only reached through the web search.`,
      },
    };
  }

  const first = subject.name.first;
  const last = subject.name.last;
  const searches: Array<{ label: string; url: string }> = [
    {
      label: 'officer or registered agent',
      url: `${BASE}/Inquiry/CorporationSearch/SearchResults/OfficerRegisteredAgentName/${encodeURIComponent(`${last} ${first}`)}/Page1`,
    },
    {
      label: 'entity name',
      url: `${BASE}/Inquiry/CorporationSearch/SearchResults/EntityName/${encodeURIComponent(last)}/Page1`,
    },
  ];

  const professionWords = professionTerms(subject.specialty);
  const maxDetail = options.maxDetailPages ?? 6;
  const hits: SearchHit[] = [];
  const failures: string[] = [];
  let checked = 0;

  for (const [index, search] of searches.entries()) {
    if (index > 0) await sleep(1200);
    const page = await fetcher.fetchPage(search.url, { keepHtml: true });
    if (page.status !== 'read' || !page.html) {
      failures.push(
        `${search.label} search: ${page.note ?? 'no readable result'}`,
      );
      continue;
    }
    checked += 1;
    const lastLower = last.toLowerCase();
    const rows = parseSunbizRows(page.html).filter((row) => {
      const name = row.name.toLowerCase();
      if (!name.includes(lastLower)) return false;
      if (search.label === 'officer or registered agent') return true;
      return (
        name.includes(first.toLowerCase()) ||
        professionWords.some((word) => name.includes(word))
      );
    });
    for (const row of rows) {
      if (hits.length >= maxDetail) break;
      if (hits.some((h) => h.url === row.url)) continue;
      hits.push({
        url: row.url,
        title: `Sunbiz: ${row.name}`,
        snippet: row.rowText.slice(0, 300),
        providerId: 'sunbiz',
        query: `Sunbiz ${search.label}: ${last}, ${first}`,
        kind: 'web',
      });
    }
  }

  if (checked === 0) {
    return {
      hits,
      report: {
        id: 'sunbiz',
        name: 'Florida Division of Corporations (Sunbiz)',
        status: 'failed',
        message: `Sunbiz could not be searched. ${failures.join(' ')} Florida corporate records were not checked; this does not mean none exist.`,
        url: `${BASE}/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent`,
      },
    };
  }
  return {
    hits,
    report: {
      id: 'sunbiz',
      name: 'Florida Division of Corporations (Sunbiz)',
      status: 'checked',
      message:
        hits.length > 0
          ? `Sunbiz returned ${hits.length} entit${hits.length === 1 ? 'y' : 'ies'} naming ${last} as officer, registered agent or in the entity name. Each is matched to the subject before it is attributed.${failures.length > 0 ? ` Partly unavailable: ${failures.join(' ')}` : ''}`
          : `Sunbiz was searched by officer/registered-agent name and entity name for "${last}, ${first}" and returned no matching entity.${failures.length > 0 ? ` Partly unavailable: ${failures.join(' ')}` : ''}`,
      url: `${BASE}/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent`,
    },
  };
}
