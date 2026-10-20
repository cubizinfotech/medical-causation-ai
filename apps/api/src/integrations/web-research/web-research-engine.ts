import { createHash } from 'node:crypto';
import { displayName } from '../expert-research/live/person-name';
import { mapWithLimit } from '../expert-research/live/live-provider.base';
import { classifyPages, mergeMatch, type ClassifierPage } from './classifier';
import {
  assessIdentity,
  findMentions,
  professionTerms,
  subjectFromQuery,
  type IdentitySubject,
} from './identity-assess';
import {
  clusterRecords,
  fingerprintOf,
  type Fingerprint,
} from './identity-clusterer';
import { excerptAround } from './page-text';
import {
  basisFor,
  extractFacts,
  factsFromSnippet,
  isOwnPage,
  organizationsIn,
  sentencesOf,
} from './claim-topics';
import { planFollowUps, planQueries, type PlannedQuery } from './query-planner';
import { verifyClaims, type SearchedSource } from './verify-claims';
import { parseCityState } from '../expert-research/live/location';
import {
  companyNamesNearSubject,
  discoverSunbiz,
  discoverSunbizCompanies,
  summarizeSunbizDetail,
} from './registries/sunbiz';
import { SafeFetcher, type FetchedPage } from './safe-fetcher';
import { classifyUrl } from './source-kind';
import { BraveSearchProvider } from './providers/brave.provider';
import { GeminiGroundedSearchProvider } from './providers/gemini-grounded.provider';
import {
  GdeltNewsProvider,
  GoogleNewsRssProvider,
} from './providers/news-feeds.provider';
import { SerperSearchProvider } from './providers/serper.provider';
import { TavilySearchProvider } from './providers/tavily.provider';
import {
  SearchProviderError,
  type SearchHit,
  type SearchProvider,
  type PageReadStatus,
  type WebBlockedPage,
  type WebClaim,
  type WebCompanyTie,
  type WebProviderReport,
  type WebRecord,
  type WebResearchDossier,
  type WebResearchLlm,
  type WebResearchQuery,
  type WebResearchSettings,
  type WebSourceKind,
} from './web-research.types';

export const DEFAULT_WEB_PROVIDER_IDS = [
  'gemini_grounding',
  'serper',
  'brave',
  'tavily',
  'google_news_rss',
  'gdelt',
] as const;

export interface WebResearchEngineDeps {
  settings: WebResearchSettings;
  providers?: SearchProvider[];
  fetcher?: SafeFetcher;
  llm?: WebResearchLlm;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function buildSearchProviders(
  settings: WebResearchSettings,
  fetchImpl?: typeof fetch,
): SearchProvider[] {
  const wanted = new Set(
    settings.providers.length > 0
      ? settings.providers
      : DEFAULT_WEB_PROVIDER_IDS,
  );
  const all: SearchProvider[] = [
    new GeminiGroundedSearchProvider(
      settings.geminiApiKey,
      settings.geminiModel ?? 'gemini-2.5-flash',
    ),
    new SerperSearchProvider(settings.serperApiKey, fetchImpl),
    new BraveSearchProvider(settings.braveApiKey, fetchImpl),
    new TavilySearchProvider(settings.tavilyApiKey, fetchImpl),
    new GoogleNewsRssProvider(fetchImpl),
    new GdeltNewsProvider(fetchImpl),
  ];
  return all.filter((provider) => wanted.has(provider.id));
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_|igshid|yclid|_ga)/i;

/** Web addresses written in the attorney's note, at most five. */
export function suppliedUrls(context: string | undefined): string[] {
  if (!context) return [];
  const found: string[] = context.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  const cleaned = found.map((address) => address.replace(/[.,;:!?]+$/, ''));
  return [...new Set(cleaned)].slice(0, 5);
}

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING.test(key)) url.searchParams.delete(key);
    }
    let value = url.toString();
    if (value.endsWith('/') && url.pathname !== '/') value = value.slice(0, -1);
    return value;
  } catch {
    return raw;
  }
}

function recordId(url: string): string {
  return `w-${createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 10)}`;
}

const SEARCH_ENGINE_HOSTS =
  /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|brave\.com|baidu\.com)$/i;

interface Page {
  id: string;
  url: string;
  title: string;
  snippet: string;
  publishedAt: string | null;
  providers: Set<string>;
  queries: Set<string>;
  kinds: Set<string>;
  place?: SearchHit['place'];
  priority: number;
}

function wordsFromUrl(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return path
      .replace(/[-_/.+]+/g, ' ')
      .replace(/\b\p{L}/gu, (m) => m.toUpperCase())
      .trim();
  } catch {
    return '';
  }
}

function modelExcerpt(
  text: string,
  description: string | null | undefined,
  subject: IdentitySubject,
): string {
  const parts: string[] = [];
  if (description) parts.push(description);
  const mentions = findMentions(text, subject.name)
    .filter((m) => m.relation !== 'different_first')
    .slice(0, 40);
  let lastEnd = -1;
  const windows: string[] = [];
  for (const mention of mentions) {
    if (mention.index < lastEnd) continue;
    const start = Math.max(0, mention.index - 450);
    const end = Math.min(text.length, mention.index + 650);
    windows.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
    lastEnd = end;
    if (windows.length >= 4) break;
  }
  if (windows.length === 0)
    windows.push(text.slice(0, 1200).replace(/\s+/g, ' '));
  parts.push(...windows);
  return parts.join('\n…\n').slice(0, 4800);
}

function isNewsLead(url: string): boolean {
  try {
    return new URL(url).hostname === 'news.google.com';
  } catch {
    return false;
  }
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Well-known platforms whose footer names are not the subject's business. */
const COMPANY_BLOCKLIST =
  /^(google|youtube|facebook|meta|microsoft|amazon|apple|twitter|linkedin|webmd|wordpress|squarespace|wix|godaddy|expert institute|jurispro|seak|researchgate|healthgrades|vitals)\b/i;

/**
 * Model readings first, then rule-extracted statements the model did not
 * already cover. Two claims are the same when they share a topic and one quote
 * contains the other.
 */
export function mergeClaims(
  model: readonly WebClaim[],
  facts: readonly WebClaim[],
): WebClaim[] {
  const out: WebClaim[] = [...model];
  for (const fact of facts) {
    const quote = normalizeText(fact.quote);
    const duplicate = out.some((existing) => {
      if ((existing.topic ?? 'other') !== (fact.topic ?? 'other')) return false;
      const other = normalizeText(existing.quote);
      return (
        other.length > 0 &&
        quote.length > 0 &&
        (other.includes(quote) || quote.includes(other))
      );
    });
    if (!duplicate) out.push(fact);
  }
  return out.slice(0, 24);
}

const IMPORTANT_KINDS: ReadonlySet<WebSourceKind> = new Set([
  'directory',
  'news',
  'court',
  'justia',
  'corporate',
  'review',
  'expert_website',
]);

export class WebResearchEngine {
  private readonly providers: SearchProvider[];
  private readonly fetcher: SafeFetcher;
  private readonly now: () => number;
  private readonly memo = new Map<
    string,
    { at: number; run: Promise<WebResearchDossier> }
  >();

  constructor(private readonly deps: WebResearchEngineDeps) {
    this.providers =
      deps.providers ?? buildSearchProviders(deps.settings, deps.fetchImpl);
    this.fetcher =
      deps.fetcher ??
      new SafeFetcher({
        timeoutMs: deps.settings.fetchTimeoutMs,
        fetchImpl: deps.fetchImpl,
        archiveFallback: deps.settings.archiveFallback,
      });
    this.now = deps.now ?? Date.now;
  }

  /** One dossier per subject, shared by every catalog source that reads it. */
  research(query: WebResearchQuery): Promise<WebResearchDossier> {
    const key = [
      query.expertName,
      query.city,
      query.specialty,
      query.npi,
      query.context,
    ]
      .map((v) => (v ?? '').trim().toLowerCase())
      .join('|');
    const cached = this.memo.get(key);
    if (cached && this.now() - cached.at < 10 * 60_000) return cached.run;
    const run = this.run(query);
    this.memo.set(key, { at: this.now(), run });
    run.catch(() => this.memo.delete(key));
    return run;
  }

  private async resolveNewsLeads(
    pool: Map<string, Page>,
    addHit: (hit: SearchHit) => void,
    providers: SearchProvider[],
    reports: Map<string, WebProviderReport>,
    until: number,
  ): Promise<void> {
    const resolver =
      providers.find(
        (p) => p.kinds.includes('web') && p.id !== 'gemini_grounding',
      ) ?? providers.find((p) => p.kinds.includes('web'));
    if (!resolver) return;
    const report = reports.get(resolver.id) as WebProviderReport;
    const leads = [...pool.entries()]
      .filter(([, page]) => isNewsLead(page.url))
      .slice(0, 6);
    await mapWithLimit(leads, 2, async ([key, lead]) => {
      if (this.now() > until) return;
      const source = lead.snippet.match(/Published by (.+?)\.?$/)?.[1] ?? '';
      report.requests += 1;
      try {
        const hits = await resolver.search(
          {
            query: `"${lead.title}" ${source}`.trim(),
            prompt: `Find the news article headlined "${lead.title}"${source ? ` published by ${source}` : ''}${lead.publishedAt ? ` around ${lead.publishedAt}` : ''}. Return that article's own page.`,
            kind: 'web',
            num: 5,
          },
          this.deps.settings.searchTimeoutMs,
        );
        report.hits += hits.length;
        const sourceKey = source.toLowerCase().replace(/[^a-z0-9]/g, '');
        const hostOf = (url: string) => {
          try {
            return new URL(url).hostname
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
          } catch {
            return '';
          }
        };
        const words = new Set(
          normalizeText(lead.title)
            .split(' ')
            .filter((w) => w.length > 3),
        );
        const overlap = (title: string) => {
          const other = normalizeText(title).split(' ');
          return words.size === 0
            ? 0
            : other.filter((w) => words.has(w)).length / words.size;
        };
        const pick =
          hits.find(
            (h) =>
              sourceKey.length > 3 &&
              hostOf(h.url).includes(sourceKey.slice(0, 8)),
          ) ??
          hits.find((h) => overlap(h.title) >= 0.6) ??
          (resolver.id === 'gemini_grounding' ? hits[0] : undefined);
        if (!pick || isNewsLead(pick.url)) return;
        pool.delete(key);
        addHit({
          ...pick,
          title: lead.title,
          snippet: lead.snippet,
          publishedAt: lead.publishedAt ?? pick.publishedAt,
          providerId: 'google_news_rss',
          query: [...lead.queries][0] ?? pick.query,
          kind: 'news',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Search failed.';
        report.failedRequests += 1;
        if (!report.failures.some((f) => f.message === message)) {
          report.failures.push({ kind: 'http', message });
        }
      }
    });
  }

  async run(query: WebResearchQuery): Promise<WebResearchDossier> {
    const started = this.now();
    const { settings } = this.deps;
    const subject = subjectFromQuery(query);
    const base = (): WebResearchDossier => ({
      ranAt: new Date(started).toISOString(),
      durationMs: this.now() - started,
      partial: false,
      partialNote: null,
      queriesPlanned: 0,
      queriesRun: 0,
      providers: [],
      pagesRead: 0,
      pagesBlocked: [],
      candidates: [],
      records: [],
      registries: [],
      limitations: [],
    });
    if (!subject) {
      return {
        ...base(),
        partial: true,
        partialNote: 'The name could not be split into a first and last name.',
        limitations: [
          'Web research was not run: the subject name needs at least a first and a last name.',
        ],
      };
    }

    const searchBy = started + settings.deadlineMs * 0.5;
    const fetchBy = started + settings.deadlineMs * 0.82;
    const endBy = started + settings.deadlineMs;
    let deadlineHit = false;

    // 1. Search.
    // The attorney's own note is never cut by the query limit.
    const planned = planQueries(subject);
    const fromNote = planned.filter((plan) => plan.topic === 'context');
    const plans = [
      ...planned
        .filter((plan) => plan.topic !== 'context')
        .slice(0, Math.max(settings.maxQueries - fromNote.length, 8)),
      ...fromNote,
    ];
    const reports = new Map<string, WebProviderReport>();
    const pool = new Map<string, Page>();
    const configured = this.providers.filter((p) => p.isConfigured());
    for (const provider of this.providers) {
      reports.set(provider.id, {
        providerId: provider.id,
        name: provider.name,
        configured: provider.isConfigured(),
        requests: 0,
        failedRequests: 0,
        hits: 0,
        failures: provider.isConfigured()
          ? []
          : [{ kind: 'skipped', message: 'Not configured (no API key).' }],
      });
    }
    let queriesPlanned = 0;
    const topicStats = new Map<string, { queries: number; hits: number }>();
    const bumpTopic = (topic: string, hits: number) => {
      const entry = topicStats.get(topic) ?? { queries: 0, hits: 0 };
      entry.queries += 1;
      entry.hits += hits;
      topicStats.set(topic, entry);
    };
    const searchedSources: SearchedSource[] = [];

    const addHit = (hit: SearchHit) => {
      let host = '';
      try {
        host = new URL(hit.url).hostname;
      } catch {
        return;
      }
      if (SEARCH_ENGINE_HOSTS.test(host) && !/\/maps\b/.test(hit.url)) {
        if (!/news\.google\.com$/.test(host)) return;
      }
      const key = canonicalUrl(hit.url);
      const page =
        pool.get(key) ??
        ({
          id: recordId(hit.url),
          url: hit.url,
          title: hit.title,
          snippet: '',
          publishedAt: null,
          providers: new Set<string>(),
          queries: new Set<string>(),
          kinds: new Set<string>(),
          priority: 0,
        } satisfies Page);
      page.providers.add(hit.providerId);
      page.queries.add(hit.query);
      page.kinds.add(hit.kind);
      if (
        hit.title &&
        (page.title === page.url || hit.title.length > page.title.length)
      ) {
        page.title = hit.title;
      }
      if (hit.snippet && hit.snippet.length > page.snippet.length)
        page.snippet = hit.snippet;
      page.publishedAt = page.publishedAt ?? hit.publishedAt ?? null;
      page.place = page.place ?? hit.place;
      pool.set(key, page);
    };

    // Addresses the attorney pasted into the request are read as sources.
    const suppliedKeys = new Set<string>();
    for (const address of suppliedUrls(query.context)) {
      suppliedKeys.add(canonicalUrl(address));
      addHit({
        url: address,
        title: address,
        providerId: 'intake_note',
        query: 'Address supplied in the request',
        kind: 'web',
      });
    }

    const sunbizPromise = discoverSunbiz(subject, this.fetcher).catch(
      (error) => ({
        hits: [] as SearchHit[],
        report: {
          id: 'sunbiz',
          name: 'Florida Division of Corporations (Sunbiz)',
          status: 'failed' as const,
          message: `Sunbiz check failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
        },
      }),
    );

    await Promise.all(
      configured.map(async (provider) => {
        const report = reports.get(provider.id) as WebProviderReport;
        const queue: PlannedQuery[] = plans
          .filter(
            (plan) =>
              provider.kinds.includes(plan.request.kind) &&
              (!plan.only || plan.only.includes(provider.id)) &&
              !plan.except?.includes(provider.id),
          )
          .slice(0, provider.budget);
        queriesPlanned += queue.length;
        let disabled = false;
        let consecutive = 0;
        await mapWithLimit(queue, provider.concurrency, async (plan) => {
          if (disabled) return;
          if (this.now() > searchBy) {
            deadlineHit = true;
            return;
          }
          for (let attempt = 1; attempt <= 2; attempt++) {
            report.requests += 1;
            try {
              const hits = await provider.search(
                plan.request,
                settings.searchTimeoutMs,
              );
              report.hits += hits.length;
              bumpTopic(plan.topic, hits.length);
              consecutive = 0;
              for (const hit of hits)
                addHit({ ...hit, query: plan.request.query });
              return;
            } catch (error) {
              const kind =
                error instanceof SearchProviderError ? error.kind : 'http';
              const message =
                error instanceof Error ? error.message : 'Search failed.';
              report.failedRequests += 1;
              if (!report.failures.some((f) => f.message === message)) {
                report.failures.push({ kind, message });
              }
              if (
                kind === 'quota' ||
                kind === 'auth' ||
                kind === 'unsupported'
              ) {
                disabled = true;
                return;
              }
              if (kind === 'rate_limited' && attempt === 1) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                continue;
              }
              consecutive += 1;
              if (consecutive >= 4) disabled = true;
              return;
            }
          }
        });
      }),
    );

    const sunbiz = await sunbizPromise;
    const sunbizUrls = new Set(sunbiz.hits.map((h) => canonicalUrl(h.url)));
    for (const hit of sunbiz.hits) addHit(hit);

    // Google News hides publisher addresses. Find each article by its headline
    // so the page itself can be read and the name checked in its text.
    await this.resolveNewsLeads(
      pool,
      addHit,
      configured,
      reports,
      searchBy + (fetchBy - searchBy) * 0.25,
    );

    // 2. Rank and read.
    const surname = subject.name.last.toLowerCase();
    const pages = [...pool.values()];
    for (const page of pages) {
      const haystack =
        `${page.title} ${page.snippet} ${wordsFromUrl(page.url)}`.toLowerCase();
      let priority = haystack.includes(surname) ? 4 : 0;
      priority += Math.min(page.providers.size, 3);
      if (IMPORTANT_KINDS.has(classifyUrl(page.url, 'web').kind)) priority += 1;
      if (sunbizUrls.has(canonicalUrl(page.url))) priority += 3;
      if (suppliedKeys.has(canonicalUrl(page.url))) priority += 20;
      page.priority = priority;
    }
    pages.sort((a, b) => b.priority - a.priority);

    const toRead = pages
      .filter((page) => !isNewsLead(page.url))
      .slice(0, settings.maxFetchPages);
    const reads = new Map<string, FetchedPage>();
    await mapWithLimit(toRead, 6, async (page) => {
      if (this.now() > fetchBy) {
        deadlineHit = true;
        return;
      }
      try {
        reads.set(page.id, await this.fetcher.fetchPage(page.url));
      } catch {
        reads.set(page.id, {
          url: page.url,
          finalUrl: page.url,
          status: 'failed',
          note: 'The page could not be read.',
        });
      }
    });

    // 2b. Businesses named on the subject's own pages: check them on Sunbiz.
    const registries = [sunbiz.report];
    const companyTies = new Map<string, string>();
    const tieLog: WebCompanyTie[] = [];
    const subjectState = parseCityState(subject.city || '').state;
    const floridaSubject = !subjectState || subjectState === 'FL';
    if (this.now() < fetchBy) {
      const tally = new Map<string, number>();
      for (const page of pages) {
        const fetched = reads.get(page.id);
        if (fetched?.status !== 'read' || !fetched.text) continue;
        if (!fetched.text.toLowerCase().includes(surname)) continue;
        if (
          ['social', 'video', 'news'].includes(
            classifyUrl(page.url, 'web').kind,
          )
        )
          continue;
        let host = '';
        try {
          host = new URL(page.url).hostname;
        } catch {
          continue;
        }
        for (const name of companyNamesNearSubject(
          fetched.text,
          surname,
          host,
        )) {
          if (COMPANY_BLOCKLIST.test(name)) continue;
          tally.set(name, (tally.get(name) ?? 0) + 1);
          if (tieLog.length < 24) {
            tieLog.push({
              name,
              url: page.url,
              scope: isOwnPage(
                classifyUrl(page.url, 'web').kind,
                page.url,
                surname,
              )
                ? 'own_page'
                : 'other_page',
              quote:
                sentencesOf(fetched.text, 300).find((sentence) =>
                  sentence.includes(name),
                ) ?? excerptAround(fetched.text, [name], 280),
            });
          }
        }
      }
      const companies = [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);
      const extra: Page[] = [];
      const track = (hit: SearchHit, company: string, register: boolean) => {
        if (register) sunbizUrls.add(canonicalUrl(hit.url));
        const known = pool.has(canonicalUrl(hit.url));
        addHit(hit);
        const added = pool.get(canonicalUrl(hit.url));
        if (added && !known && !pages.includes(added)) {
          added.priority = 6;
          extra.push(added);
        }
        if (added) companyTies.set(canonicalUrl(hit.url), company);
      };
      if (companies.length > 0 && floridaSubject) {
        const found = await discoverSunbizCompanies(
          companies,
          this.fetcher,
        ).catch(() => null);
        if (found) {
          registries.push(found.report);
          for (const hit of found.hits)
            track(hit, hit.query.replace(/^Sunbiz entity name: /, ''), true);
        }
      }
      // Registry sites often refuse automated readers; a web search for the
      // company still finds the registry listing and other business records.
      const finder =
        configured.find(
          (p) => p.kinds.includes('web') && p.id !== 'gemini_grounding',
        ) ?? configured.find((p) => p.kinds.includes('web'));
      if (finder && companies.length > 0 && this.now() < fetchBy) {
        const report = reports.get(finder.id) as WebProviderReport;
        await mapWithLimit(companies.slice(0, 2), 2, async (company) => {
          report.requests += 1;
          try {
            const hits = await finder.search(
              {
                query: `"${company}" ${floridaSubject ? 'Florida ' : ''}(sunbiz OR opencorporates OR bizapedia OR "registered agent" OR "annual report")`,
                prompt: `Find the business registry record for "${company}"${floridaSubject ? ' on the Florida Division of Corporations (Sunbiz)' : ''} or on OpenCorporates, Bizapedia or similar: document number, status, filing date, principal address, registered agent and officers or managers.`,
                kind: 'web',
                num: 8,
              },
              settings.searchTimeoutMs,
            );
            report.hits += hits.length;
            for (const hit of hits)
              track(
                { ...hit, query: `Business record: ${company}` },
                company,
                false,
              );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Search failed.';
            report.failedRequests += 1;
            if (!report.failures.some((f) => f.message === message)) {
              report.failures.push({ kind: 'http', message });
            }
          }
        });
      }
      if (extra.length > 0) {
        await mapWithLimit(extra, 4, async (page) => {
          if (this.now() > fetchBy) return;
          reads.set(page.id, await this.fetcher.fetchPage(page.url));
        });
        pages.push(...extra);
      }
    }

    // 2c. Second round. Pages that name the subject mention the bodies that
    // certified or listed them; search each body's own site and the state
    // license lookup, then read what comes back.
    const followBy = started + settings.deadlineMs * 0.7;
    if (this.now() < followBy) {
      const acronyms = new Set<string>();
      for (const page of pages) {
        const fetched = reads.get(page.id);
        if (fetched?.status !== 'read' || !fetched.text) continue;
        if (!fetched.text.toLowerCase().includes(surname)) continue;
        for (const org of organizationsIn(fetched.text)) {
          if (org.acronym) acronyms.add(org.acronym);
        }
      }
      const followPlans = planFollowUps(subject, {
        acronyms: [...acronyms],
        state: subjectState || null,
      });
      const followProviders = configured
        .filter(
          (p) =>
            p.kinds.includes('web') &&
            ['gemini_grounding', 'serper', 'brave', 'tavily'].includes(p.id),
        )
        .filter((p) => {
          const r = reports.get(p.id) as WebProviderReport;
          return r.requests === 0 || r.failedRequests < r.requests;
        })
        .slice(0, 2);
      const fresh: Page[] = [];
      queriesPlanned += followPlans.length * followProviders.length;
      const answered = new Set<string>();
      await Promise.all(
        followProviders.map(async (provider) => {
          const report = reports.get(provider.id) as WebProviderReport;
          await mapWithLimit(followPlans, 2, async (plan) => {
            if (this.now() > followBy) {
              deadlineHit = true;
              return;
            }
            report.requests += 1;
            try {
              const hits = await provider.search(
                plan.request,
                settings.searchTimeoutMs,
              );
              report.hits += hits.length;
              bumpTopic(plan.topic, hits.length);
              answered.add(plan.id);
              for (const hit of hits) {
                const known = pool.has(canonicalUrl(hit.url));
                addHit({ ...hit, query: plan.request.query });
                const added = pool.get(canonicalUrl(hit.url));
                if (added && !known && !pages.includes(added)) {
                  added.priority = 7;
                  fresh.push(added);
                }
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Search failed.';
              report.failedRequests += 1;
              if (!report.failures.some((f) => f.message === message)) {
                report.failures.push({ kind: 'http', message });
              }
            }
          });
        }),
      );
      for (const plan of followPlans) {
        if (plan.official && answered.has(plan.id)) {
          searchedSources.push(plan.official);
        }
      }
      if (fresh.length > 0) {
        const unique = [...new Set(fresh)].slice(0, 12);
        await mapWithLimit(unique, 4, async (page) => {
          if (this.now() > fetchBy) {
            deadlineHit = true;
            return;
          }
          try {
            reads.set(page.id, await this.fetcher.fetchPage(page.url));
          } catch {
            reads.set(page.id, {
              url: page.url,
              finalUrl: page.url,
              status: 'failed',
              note: 'The page could not be read.',
            });
          }
        });
        pages.push(...unique);
      }
    }

    // 3. Assess identity, then let the model read what the rules cannot.
    interface Work {
      page: Page;
      fetched: FetchedPage | null;
      readText: string;
      limited: boolean;
      assessment: ReturnType<typeof assessIdentity>;
    }
    const work: Work[] = [];
    const blocked: WebBlockedPage[] = [];
    let droppedNoMention = 0;
    const suppliedWithoutName: string[] = [];
    for (const page of pages) {
      const fetched = reads.get(page.id) ?? null;
      const limited = fetched?.status !== 'read';
      const readText = limited
        ? `${page.title}\n${page.snippet}\n${wordsFromUrl(page.url)}`
        : (fetched?.text ?? '');
      let assessment = assessIdentity(
        { title: fetched?.title ?? page.title, text: readText },
        subject,
        { limitedText: limited },
      );
      if (assessment.level === 'none' && isNewsLead(page.url)) {
        // A news index returned this headline for a search on the exact name,
        // but the headline does not carry it and the article is not reachable.
        assessment = {
          ...assessment,
          level: 'weak',
          confidence: 'low',
          basis: [
            'A news search for the exact name returned this headline. The headline does not contain the name and the article address is not exposed by the news index, so the article was not read and is not attributed to the subject.',
          ],
        };
      }
      const company = companyTies.get(canonicalUrl(page.url));
      if (assessment.level === 'none' && company) {
        const haystack = normalizeText(
          `${page.title} ${page.snippet} ${readText}`,
        );
        if (haystack.includes(normalizeText(company))) {
          assessment = {
            ...assessment,
            level: 'possible',
            confidence: 'low',
            basis: [
              `The page is about ${company}, a business named next to the subject’s name on a page that is tied to the subject. The registry page does not itself name the subject, so this is a possible link, not a confirmed one.`,
            ],
            quote: excerptAround(readText, [company.split(',')[0]], 300),
          };
        }
      }
      if (
        fetched &&
        (fetched.status === 'restricted' || fetched.status === 'failed')
      ) {
        if (assessment.nameMatch !== 'none' || page.priority >= 4) {
          blocked.push({ url: page.url, reason: fetched.note ?? 'Not read.' });
        }
      }
      const supplied = suppliedKeys.has(canonicalUrl(page.url));
      if (supplied && limited) {
        // The attorney named this page, so it stays visible even though it
        // could not be read. Nothing from it is attributed to the subject.
        assessment = {
          ...assessment,
          level: assessment.level === 'none' ? 'weak' : assessment.level,
          confidence: 'low',
          basis: [
            'This address was supplied in the request. The page could not be read, so what it says about the subject is unknown and nothing is attributed from it.',
            ...assessment.basis,
          ],
        };
      } else if (supplied && assessment.level === 'none') {
        suppliedWithoutName.push(page.url);
      }
      if (assessment.level === 'none') {
        droppedNoMention += 1;
        continue;
      }
      work.push({ page, fetched, readText, limited, assessment });
    }

    const classifiable = work
      .filter((w) => !isNewsLead(w.page.url))
      .filter((w) => w.assessment.level !== 'other_person' || !w.limited)
      .slice(0, 36);
    const classifierPages: ClassifierPage[] = classifiable.map((w) => ({
      id: w.page.id,
      url: w.page.url,
      title: w.fetched?.title ?? w.page.title,
      text: w.limited
        ? `${w.page.title}\n${w.page.snippet}`.trim()
        : modelExcerpt(w.readText, w.fetched?.description, subject),
      fullPage: !w.limited,
    }));
    let classifications = new Map<
      string,
      import('./classifier').ModelClassification
    >();
    let modelNote: string | null = null;
    if (this.deps.llm && classifierPages.length > 0) {
      if (this.now() < endBy - 20_000) {
        classifications = await classifyPages(
          this.deps.llm,
          subject,
          classifierPages,
        );
        if (classifications.size === 0) {
          modelNote =
            'The language model did not return a usable reading of the pages, so identity was judged by rules only.';
        }
      } else {
        deadlineHit = true;
        modelNote =
          'Time ran out before the pages could be read by the language model.';
      }
    } else if (!this.deps.llm) {
      modelNote =
        'No language model was available, so identity was judged by rules only.';
    }

    // 4. Build records.
    const fingerprints = new Map<string, Fingerprint>();
    const retrievedAt = new Date(this.now()).toISOString();
    const records: WebRecord[] = work.map((w) => {
      const model = classifications.get(w.page.id);
      const merged = mergeMatch(
        w.assessment,
        model,
        subject.name.last,
        professionTerms(subject.specialty),
      );
      // A page is "news" by search kind only when a news index returned it;
      // Gemini and web engines answer news-style queries with any kind of page.
      const fromNewsIndex = [...w.page.providers].every((id) =>
        ['google_news_rss', 'gdelt'].includes(id),
      );
      const url = classifyUrl(w.page.url, fromNewsIndex ? 'news' : 'web');
      let kind: WebSourceKind = url.kind;
      if (sunbizUrls.has(canonicalUrl(w.page.url))) kind = 'corporate';
      else if (kind === 'other' && model?.kind) kind = model.kind;
      else if (
        model?.kind &&
        ['expert_website', 'advertising', 'ime', 'profile'].includes(
          model.kind,
        ) &&
        (kind === 'other' || kind === 'news')
      ) {
        kind = model.kind;
      }
      const ownPage = isOwnPage(kind, w.page.url, subject.name.last);
      const tiedToSubject =
        merged.level === 'strong' || merged.level === 'possible';
      const modelClaims: WebClaim[] = (model?.claims ?? []).map((claim) => ({
        ...claim,
        basis:
          claim.basis ??
          basisFor(claim.topic ?? 'other', { url: w.page.url, ownPage }),
      }));
      const factClaims: WebClaim[] = !tiedToSubject
        ? []
        : w.limited
          ? factsFromSnippet({
              url: w.page.url,
              kind,
              snippet: w.page.snippet,
              subject,
            })
          : extractFacts({
              url: w.page.url,
              kind,
              title: w.fetched?.title ?? w.page.title,
              text: w.readText,
              subject,
              ownPage,
            });
      const sunbizSummary =
        kind === 'corporate' && w.fetched?.text
          ? summarizeSunbizDetail(w.fetched.text)
          : null;
      const excerpt =
        w.limited || !w.readText
          ? null
          : excerptAround(w.readText, [subject.name.last], 420);
      const summary =
        sunbizSummary ??
        (isNewsLead(w.page.url)
          ? `Headline from a news search on the name: "${w.page.title}". ${w.page.snippet}`.trim()
          : null) ??
        model?.summary ??
        (w.limited
          ? w.page.snippet ||
            'Listed by the search engine; the page itself was not read.'
          : (w.fetched?.description ?? excerpt ?? ''));
      fingerprints.set(w.page.id, fingerprintOf(w.readText, subject));
      const read: PageReadStatus = !w.fetched
        ? w.page.snippet
          ? 'snippet_only'
          : 'not_read'
        : w.fetched.status === 'read'
          ? 'read'
          : w.fetched.status === 'restricted'
            ? 'restricted'
            : w.page.snippet
              ? 'snippet_only'
              : 'failed';
      return {
        id: w.page.id,
        url:
          w.fetched?.finalUrl && w.fetched.status === 'read'
            ? w.fetched.finalUrl
            : w.page.url,
        title: (w.fetched?.title ?? w.page.title).slice(0, 240),
        kind,
        ...(url.platform ? { platform: url.platform } : {}),
        ...(url.directoryId ? { directoryId: url.directoryId } : {}),
        snippet: w.page.snippet || null,
        summary: summary.slice(0, 700),
        publishedAt:
          model?.published ??
          w.fetched?.publishedAt ??
          w.page.publishedAt ??
          null,
        retrievedAt,
        searchProviders: [...w.page.providers],
        queries: [...w.page.queries].slice(0, 4),
        read,
        ...(w.fetched?.archiveUrl ? { archiveUrl: w.fetched.archiveUrl } : {}),
        readNote:
          w.fetched?.note ??
          (w.fetched
            ? null
            : 'Not opened: outside this run’s page-reading limit.'),
        match: {
          level: merged.level,
          confidence: merged.confidence,
          basis: merged.basis,
          conflicts: merged.conflicts,
          quote: merged.quote,
          quoteVerified: merged.quoteVerified,
          classifiedBy: merged.classifiedBy,
        },
        candidateId: null,
        claims: mergeClaims(modelClaims, factClaims),
        ...(w.page.place ? { place: w.page.place } : {}),
        rating: model?.rating ?? null,
      };
    });

    const subjectLabel = [
      displayName(subject.name),
      subject.specialty,
      subject.city || null,
    ]
      .filter(Boolean)
      .join(', ');
    const clustered = clusterRecords(
      records,
      fingerprints,
      subject,
      subjectLabel,
    );
    const order = {
      strong: 0,
      possible: 1,
      weak: 2,
      other_person: 3,
      none: 4,
    } as const;
    const finalRecords = clustered.records
      .sort(
        (a, b) =>
          order[a.match.level] - order[b.match.level] ||
          (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      )
      .slice(0, 150);

    const tiedIds = new Set(
      finalRecords
        .filter(
          (r) => r.match.level === 'strong' || r.match.level === 'possible',
        )
        .map((r) => r.id),
    );
    const seenTies = new Set<string>();
    const companiesOnTiedPages = tieLog.filter((tie) => {
      if (!tiedIds.has(recordId(tie.url))) return false;
      const key = `${tie.name.toLowerCase()}|${canonicalUrl(tie.url)}`;
      if (seenTies.has(key)) return false;
      seenTies.add(key);
      return true;
    });

    // 5. Limits of this run.
    const limitations: string[] = [];
    const usable = configured.filter((p) => {
      const r = reports.get(p.id) as WebProviderReport;
      return r.requests > 0 && r.failedRequests < r.requests;
    });
    if (configured.length === 0) {
      limitations.push(
        'No web search provider is configured, so no web search was run. Set GEMINI_API_KEY (Google Search grounding) or SERPER_API_KEY, BRAVE_SEARCH_API_KEY or TAVILY_API_KEY.',
      );
    } else if (usable.length === 0) {
      limitations.push(
        'Every configured web search provider failed. Nothing here means "no web presence"; the searches did not complete.',
      );
    }
    for (const report of reports.values()) {
      if (report.configured && report.failures.length > 0) {
        limitations.push(
          `${report.name}: ${report.failures.length} problem${report.failures.length === 1 ? '' : 's'} (${[...new Set(report.failures.map((f) => f.kind))].join(', ')}). ${report.failures[0].message}`,
        );
      }
    }
    for (const unconfigured of ['serper', 'brave', 'tavily']) {
      const report = reports.get(unconfigured);
      if (report && !report.configured) {
        limitations.push(
          `${report.name} was not used (no API key). Coverage comes from the other providers.`,
        );
      }
    }
    if (blocked.length > 0) {
      limitations.push(
        `${blocked.length} page${blocked.length === 1 ? '' : 's'} could not be read (login, CAPTCHA/bot protection, robots.txt, or paywall). They are listed by address only; logins and challenges are never bypassed.`,
      );
    }
    limitations.push(
      'Facebook, Instagram, LinkedIn, X, TikTok and similar sites show content only to signed-in users. They are never opened; a profile is listed only when a search engine returned its address.',
    );
    if (modelNote) limitations.push(modelNote);
    for (const address of suppliedWithoutName) {
      limitations.push(
        `The address supplied in the request was read, but its text does not mention the subject: ${address}`,
      );
    }
    if (droppedNoMention > 0) {
      limitations.push(
        `${droppedNoMention} search result${droppedNoMention === 1 ? '' : 's'} did not mention the subject's surname and were left out.`,
      );
    }
    limitations.push(
      'A web search cannot prove that something does not exist. "Not found" means not found in what these search engines returned today.',
    );

    return {
      ranAt: new Date(started).toISOString(),
      durationMs: this.now() - started,
      partial: deadlineHit || (configured.length > 0 && usable.length === 0),
      partialNote: deadlineHit
        ? 'The time limit for web research was reached before every query or page was processed.'
        : null,
      queriesPlanned,
      queriesRun: [...reports.values()].reduce((sum, r) => sum + r.requests, 0),
      providers: [...reports.values()],
      pagesRead: [...reads.values()].filter((r) => r.status === 'read').length,
      pagesBlocked: blocked.slice(0, 40),
      candidates: clustered.candidates,
      records: finalRecords,
      registries,
      limitations,
      topics: [...topicStats.entries()].map(([topic, stat]) => ({
        topic,
        queries: stat.queries,
        hits: stat.hits,
      })),
      companies: companiesOnTiedPages,
      verifications: verifyClaims(finalRecords, [
        ...searchedSources,
        ...registries
          .filter((r) => r.status === 'checked')
          .map((r) => ({
            label: r.name,
            topics: ['corporate'] as const,
          })),
      ]),
    };
  }
}
