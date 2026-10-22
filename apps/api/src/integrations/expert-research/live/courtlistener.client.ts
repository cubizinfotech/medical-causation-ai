import { fetchJson } from './live-http';

export const COURTLISTENER_SITE = 'https://www.courtlistener.com';
export const COURTLISTENER_API = `${COURTLISTENER_SITE}/api/rest/v4`;

export interface CourtListenerOpinionHit {
  id?: number;
  snippet?: string;
}

export interface CourtListenerSearchHit {
  absolute_url?: string;
  caseName?: string;
  caseNameFull?: string;
  cluster_id?: number;
  court?: string;
  court_citation_string?: string;
  dateFiled?: string | null;
  docketNumber?: string | null;
  citation?: string[];
  status?: string;
  opinions?: CourtListenerOpinionHit[];
  /** RECAP document fields when type=rd. */
  id?: number;
  description?: string;
  document_number?: string | number | null;
  attachment_number?: string | number | null;
  is_available?: boolean;
  snippet?: string;
  docket_id?: number;
}

interface SearchResponse {
  count?: number;
  results?: CourtListenerSearchHit[];
}

interface OpinionResponse {
  plain_text?: string;
  html_with_citations?: string;
  html?: string;
  html_lawbox?: string;
  html_columbia?: string;
  xml_harvard?: string;
}

export interface CourtListenerClientOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  /** Optional. Search works without it; opinion text needs it. */
  token?: string;
  baseUrl?: string;
}

/** CourtListener (Free Law Project) case law search, read only. */
export class CourtListenerClient {
  constructor(private readonly options: CourtListenerClientOptions) {}

  get canReadOpinions(): boolean {
    return Boolean(this.options.token);
  }

  async searchOpinions(
    query: string,
  ): Promise<{ hits: CourtListenerSearchHit[]; count: number }> {
    return this.search(query, 'o');
  }

  /**
   * RECAP PACER filings that are already public (motions, orders, pleadings).
   * This is not a complete docket pull.
   */
  async searchRecapDocuments(
    query: string,
  ): Promise<{ hits: CourtListenerSearchHit[]; count: number }> {
    return this.search(query, 'rd');
  }

  private async search(
    query: string,
    type: 'o' | 'rd',
  ): Promise<{ hits: CourtListenerSearchHit[]; count: number }> {
    const url = new URL(`${this.baseUrl}/search/`);
    url.searchParams.set('q', query);
    url.searchParams.set('type', type);
    url.searchParams.set('highlight', 'on');
    url.searchParams.set('order_by', 'score desc');
    const body = await fetchJson<SearchResponse>(url, {
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
      headers: this.headers,
    });
    return { hits: body.results ?? [], count: body.count ?? 0 };
  }

  /**
   * Plain text of a RECAP filing that is already public. Unavailable
   * documents are not fetched from PACER.
   */
  async recapDocumentText(documentId: number): Promise<string> {
    const url = new URL(`${this.baseUrl}/recap-documents/${documentId}/`);
    url.searchParams.set('fields', 'plain_text,is_available,description');
    const body = await fetchJson<{
      plain_text?: string;
      is_available?: boolean;
    }>(url, {
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
      headers: this.headers,
    });
    if (body.is_available === false) return '';
    return body.plain_text?.trim() ?? '';
  }

  /** Opinion text as plain text. Requires a token. */
  async opinionText(opinionId: number): Promise<string> {
    const url = new URL(`${this.baseUrl}/opinions/${opinionId}/`);
    url.searchParams.set(
      'fields',
      'plain_text,html_with_citations,html,html_lawbox,html_columbia,xml_harvard',
    );
    const body = await fetchJson<OpinionResponse>(url, {
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
      headers: this.headers,
    });
    const plain = body.plain_text?.trim();
    if (plain) return plain;
    const markup =
      body.html_with_citations ||
      body.html ||
      body.html_lawbox ||
      body.html_columbia ||
      body.xml_harvard ||
      '';
    return htmlToText(markup);
  }

  private get headers(): Record<string, string> | undefined {
    return this.options.token
      ? { Authorization: `Token ${this.options.token}` }
      : undefined;
  }

  private get baseUrl(): string {
    return (this.options.baseUrl ?? COURTLISTENER_API).replace(/\/$/, '');
  }
}

export function htmlToText(markup: string): string {
  return (
    markup
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
      // Inline tags (highlights, citation links) sit inside words and sentences.
      .replace(
        /<\/?(?:mark|em|strong|b|i|u|span|a|sup|sub|small)(?:\s[^>]*)?>/gi,
        '',
      )
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim()
  );
}
