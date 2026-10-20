import { fetchJson } from './live-http';

export interface CrossrefWork {
  DOI?: string;
  URL?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string; name?: string }>;
  issued?: { 'date-parts'?: number[][] };
  'container-title'?: string[];
}

/** Crossref REST API: authoritative publisher-supplied author lists, in order. */
export class CrossrefClient {
  constructor(
    private readonly options: {
      timeoutMs: number;
      fetchImpl?: typeof fetch;
      mailto?: string;
      baseUrl?: string;
    },
  ) {}

  async searchWorks(title: string, rows = 3): Promise<CrossrefWork[]> {
    const url = new URL(
      `${this.options.baseUrl ?? 'https://api.crossref.org'}/works`,
    );
    url.searchParams.set('query.bibliographic', title);
    url.searchParams.set('rows', String(rows));
    url.searchParams.set(
      'select',
      'DOI,URL,title,author,issued,container-title',
    );
    if (this.options.mailto)
      url.searchParams.set('mailto', this.options.mailto);
    const body = await fetchJson<{ message?: { items?: CrossrefWork[] } }>(
      url,
      {
        timeoutMs: this.options.timeoutMs,
        fetchImpl: this.options.fetchImpl,
      },
    );
    return body.message?.items ?? [];
  }
}

/** "Jason A." + "Demery" -> "Jason A. Demery". */
export function crossrefAuthorNames(work: CrossrefWork): string[] {
  return (work.author ?? [])
    .map(
      (author) =>
        author.name ?? [author.given, author.family].filter(Boolean).join(' '),
    )
    .map((name) => name.trim())
    .filter(Boolean);
}
