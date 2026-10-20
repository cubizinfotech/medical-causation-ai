import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { classifyUrl } from './source-kind';
import { extractPageText, type PageText } from './page-text';
import { extractPdfText } from './pdf-text';
import type { PageReadStatus } from './web-research.types';

export interface FetchedPage extends Partial<PageText> {
  url: string;
  finalUrl: string;
  status: PageReadStatus;
  /** Why the page was not read, or what limited it. */
  note: string | null;
  httpStatus?: number;
  contentType?: string;
  /** Raw markup, only when the caller asked for it (registry result tables). */
  html?: string;
  /** The site answered with bot protection or refused automated access. */
  botBlocked?: boolean;
  /** Set when the text came from an Internet Archive copy. */
  archiveUrl?: string;
}

export interface SafeFetcherOptions {
  fetchImpl?: typeof fetch;
  lookup?: (host: string) => Promise<Array<{ address: string }>>;
  timeoutMs: number;
  maxBytes?: number;
  userAgent?: string;
  /** Read the Internet Archive copy of a bot-blocked page. Default true. */
  archiveFallback?: boolean;
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; EWI-PublicResearch/1.0; +public-records-research)';
const MAX_REDIRECTS = 5;

const CHALLENGE_MARKERS = [
  /just a moment\.\.\./i,
  /attention required!? \| cloudflare/i,
  /enable javascript and cookies to continue/i,
  /verify you are (a )?human/i,
  /are you a robot/i,
  /captcha/i,
  /access denied/i,
  /request blocked/i,
  /unusual traffic/i,
  /checking your browser/i,
  /_incapsula_resource/i,
  /perimeterx|px-captcha/i,
  /datadome/i,
];

const PAYWALL_MARKERS = [
  /subscribe (now )?to (continue|keep) reading/i,
  /this (article|content) is (for )?(subscribers|members)( only)?/i,
  /sign in to (continue|read)/i,
  /create (a free )?account to (continue|read)/i,
  /you['\u2019]ve (reached|hit) your (free )?(article|monthly) limit/i,
];

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(lower)) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

function parseRobots(body: string): RobotsRules {
  const groups: Array<{
    agents: string[];
    disallow: string[];
    allow: string[];
  }> = [];
  let current: {
    agents: string[];
    disallow: string[];
    allow: string[];
  } | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'disallow' && value) current.disallow.push(value);
    if (field === 'allow' && value) current.allow.push(value);
  }
  const ours = groups.find((g) =>
    g.agents.some((a) => a !== '*' && 'ewi-publicresearch'.includes(a)),
  );
  const star = groups.find((g) => g.agents.includes('*'));
  return ours ?? star ?? { disallow: [], allow: [] };
}

function robotsAllows(rules: RobotsRules, path: string): boolean {
  const matches = (pattern: string) => {
    const source = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\\\$$/, '$');
    return new RegExp(`^${source}`).test(path);
  };
  const longest = (patterns: string[]) =>
    patterns.filter(matches).reduce((max, p) => Math.max(max, p.length), -1);
  const deny = longest(rules.disallow);
  if (deny < 0) return true;
  return longest(rules.allow) >= deny;
}

/**
 * Reads public web pages the way a person with a browser could, and no
 * further: HTTPS/HTTP only, no private addresses, robots.txt respected,
 * sign-in sites never fetched, and bot challenges or paywalls reported
 * rather than worked around.
 */
export class SafeFetcher {
  private readonly fetchImpl: typeof fetch;
  private readonly lookup: NonNullable<SafeFetcherOptions['lookup']>;
  private readonly robots = new Map<string, Promise<RobotsRules | null>>();
  private readonly maxBytes: number;
  private readonly userAgent: string;

  constructor(private readonly options: SafeFetcherOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.lookup =
      options.lookup ??
      ((host) => dnsLookup(host, { all: true, verbatim: true }));
    this.maxBytes = options.maxBytes ?? 1_500_000;
    this.userAgent = options.userAgent ?? USER_AGENT;
  }

  /**
   * Reads a page. When the publisher's own site answers with bot protection,
   * the Internet Archive's public copy is read instead, if one exists, and the
   * result says so. Nothing is done to the protected site itself.
   */
  async fetchPage(
    rawUrl: string,
    options: { keepHtml?: boolean } = {},
  ): Promise<FetchedPage> {
    const direct = await this.fetchDirect(rawUrl, options);
    if (
      direct.status !== 'restricted' ||
      !direct.botBlocked ||
      options.keepHtml ||
      this.options.archiveFallback === false
    ) {
      return direct;
    }
    return (await this.fromArchive(rawUrl)) ?? direct;
  }

  private async fromArchive(rawUrl: string): Promise<FetchedPage | null> {
    try {
      const response = await this.fetchImpl(
        `https://archive.org/wayback/available?url=${encodeURIComponent(rawUrl)}`,
        {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) return null;
      const json = (await response.json()) as {
        archived_snapshots?: {
          closest?: {
            available?: boolean;
            url?: string;
            timestamp?: string;
            status?: string;
          };
        };
      };
      const snapshot = json.archived_snapshots?.closest;
      if (
        !snapshot?.available ||
        !snapshot.url ||
        (snapshot.status && snapshot.status !== '200')
      ) {
        return null;
      }
      const archiveUrl = snapshot.url.replace(/^http:/, 'https:');
      const page = await this.fetchDirect(archiveUrl, {});
      if (page.status !== 'read') return null;
      const stamp = snapshot.timestamp?.match(/^(\d{4})(\d{2})(\d{2})/);
      const captured = stamp
        ? `${stamp[1]}-${stamp[2]}-${stamp[3]}`
        : 'an earlier date';
      return {
        ...page,
        url: rawUrl,
        finalUrl: rawUrl,
        archiveUrl,
        note: `The publisher's site blocks automated access, so this was read from the Internet Archive copy captured ${captured}. The live page may differ.`,
      };
    } catch {
      return null;
    }
  }

  private async fetchDirect(
    rawUrl: string,
    options: { keepHtml?: boolean } = {},
  ): Promise<FetchedPage> {
    const base = { url: rawUrl, finalUrl: rawUrl };
    let current: URL;
    try {
      current = new URL(rawUrl);
    } catch {
      return {
        ...base,
        status: 'failed',
        note: 'The address is not a valid URL.',
      };
    }

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const refusal = await this.refuse(current);
      if (refusal) {
        return { ...base, finalUrl: current.toString(), ...refusal };
      }

      let response: Response;
      try {
        response = await this.fetchImpl(current, {
          redirect: 'manual',
          headers: {
            'User-Agent': this.userAgent,
            Accept:
              'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
      } catch (error) {
        const timedOut =
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError');
        return {
          ...base,
          finalUrl: current.toString(),
          status: 'failed',
          note: timedOut
            ? 'The page timed out.'
            : 'The page could not be reached.',
        };
      }

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        try {
          current = new URL(location, current);
        } catch {
          return {
            ...base,
            finalUrl: current.toString(),
            status: 'failed',
            note: 'The page redirected to an invalid address.',
          };
        }
        continue;
      }
      return this.readResponse(base.url, current, response, options.keepHtml);
    }
    return {
      ...base,
      finalUrl: current.toString(),
      status: 'failed',
      note: 'The page redirected too many times.',
    };
  }

  private async refuse(
    url: URL,
  ): Promise<Pick<FetchedPage, 'status' | 'note'> | null> {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { status: 'failed', note: 'Only http and https pages are read.' };
    }
    const classification = classifyUrl(url.toString(), 'web');
    if (classification.loginGated) {
      return {
        status: 'restricted',
        note: `${classification.platform ?? 'This site'} shows its content to signed-in users. It was not opened and no login was attempted.`,
      };
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return { status: 'failed', note: 'Internal addresses are not fetched.' };
    }
    try {
      const addresses = isIP(host)
        ? [{ address: host }]
        : await this.lookup(host);
      if (
        addresses.length === 0 ||
        addresses.some((a) => isPrivateAddress(a.address))
      ) {
        return {
          status: 'failed',
          note: 'Internal addresses are not fetched.',
        };
      }
    } catch {
      return { status: 'failed', note: 'The site name could not be resolved.' };
    }
    const rules = await this.robotsFor(url);
    if (rules && !robotsAllows(rules, url.pathname + url.search)) {
      return {
        status: 'restricted',
        note: 'The site’s robots.txt asks automated tools not to read this page. It was not fetched.',
      };
    }
    return null;
  }

  private robotsFor(url: URL): Promise<RobotsRules | null> {
    const origin = url.origin;
    let cached = this.robots.get(origin);
    if (!cached) {
      cached = (async () => {
        try {
          const response = await this.fetchImpl(`${origin}/robots.txt`, {
            redirect: 'follow',
            headers: { 'User-Agent': this.userAgent },
            signal: AbortSignal.timeout(Math.min(this.options.timeoutMs, 6000)),
          });
          if (!response.ok) return null;
          const type = response.headers.get('content-type') ?? '';
          if (/html/i.test(type)) return null;
          return parseRobots((await response.text()).slice(0, 200_000));
        } catch {
          return null;
        }
      })();
      this.robots.set(origin, cached);
    }
    return cached;
  }

  private async readResponse(
    requested: string,
    url: URL,
    response: Response,
    keepHtml = false,
  ): Promise<FetchedPage> {
    const finalUrl = url.toString();
    const contentType = response.headers.get('content-type') ?? '';
    const common = {
      url: requested,
      finalUrl,
      httpStatus: response.status,
      contentType,
    };

    if (response.status === 401 || response.status === 402) {
      return {
        ...common,
        status: 'restricted',
        note: `The page requires a login or payment (HTTP ${response.status}). It was not accessed.`,
      };
    }
    let body = '';
    const isPdf =
      /application\/pdf/i.test(contentType) ||
      (/octet-stream/i.test(contentType) &&
        /\.pdf($|\?)/i.test(url.pathname + url.search));
    if (isPdf && response.status < 400) {
      const bytes = await this.readBytes(response, 8_000_000);
      try {
        const pdf = await extractPdfText(bytes);
        if (pdf.text.length < 120) {
          return {
            ...common,
            title: pdf.title,
            status: 'failed',
            note: 'The PDF has no readable text (it is probably a scanned image). It was not run through OCR.',
          };
        }
        return {
          ...common,
          title: pdf.title ?? pdf.text.split('\n')[0].slice(0, 160),
          description: null,
          publishedAt: null,
          text: pdf.text,
          status: 'read',
          note:
            pdf.pages > 25
              ? `PDF read from its first 25 of ${pdf.pages} pages.`
              : null,
        };
      } catch {
        return {
          ...common,
          status: 'failed',
          note: 'The PDF could not be read.',
        };
      }
    }
    if (/text\/|html|xml|json/i.test(contentType) || contentType === '') {
      body = await this.readBody(response);
    } else if (response.status < 400) {
      return {
        ...common,
        status: 'failed',
        note: `The page is a ${contentType.split(';')[0]} file, which is not read as text.`,
      };
    }

    const blocked =
      response.headers.get('cf-mitigated') === 'challenge' ||
      ([403, 429, 503].includes(response.status) &&
        CHALLENGE_MARKERS.some((m) => m.test(body.slice(0, 20_000))));
    if (blocked) {
      return {
        ...common,
        status: 'restricted',
        botBlocked: true,
        note: `The site answered with a bot-protection or CAPTCHA page (HTTP ${response.status}). It was not bypassed, so this page's content was not read.`,
      };
    }
    if (response.status === 403) {
      return {
        ...common,
        status: 'restricted',
        botBlocked: true,
        note: 'The site refused automated access (HTTP 403). It was not bypassed.',
      };
    }
    if (response.status >= 400) {
      return {
        ...common,
        status: 'failed',
        note: `The page returned HTTP ${response.status}.`,
      };
    }

    const page = /text\/plain|json/i.test(contentType)
      ? { title: null, description: null, publishedAt: null, text: body }
      : extractPageText(body);
    const head = body.slice(0, 40_000);
    if (page.text.length < 200 && CHALLENGE_MARKERS.some((m) => m.test(head))) {
      return {
        ...common,
        ...page,
        status: 'restricted',
        botBlocked: true,
        note: 'The site returned a bot-protection or CAPTCHA page. It was not bypassed.',
      };
    }
    if (page.text.length < 120) {
      return {
        ...common,
        ...page,
        status: 'failed',
        note: 'The page has no readable text (it may need JavaScript to display).',
      };
    }
    const paywalled =
      PAYWALL_MARKERS.some((m) => m.test(page.text)) && page.text.length < 2500;
    return {
      ...common,
      ...page,
      ...(keepHtml ? { html: body } : {}),
      status: 'read',
      note: paywalled
        ? 'The page appears to be partly behind a paywall or sign-in; only the visible part was read.'
        : null,
    };
  }

  private async readBody(response: Response): Promise<string> {
    return (await this.readBytes(response, this.maxBytes)).toString('utf8');
  }

  private async readBytes(response: Response, limit: number): Promise<Buffer> {
    if (!response.body) {
      return Buffer.from(await response.arrayBuffer()).subarray(0, limit);
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (size < limit) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.byteLength;
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }
}
