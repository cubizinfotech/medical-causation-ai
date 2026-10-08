import { fetchJson } from './live-http';

export const OPENALEX_API = 'https://api.openalex.org';

export interface OpenAlexInstitutionRef {
  id: string;
  display_name?: string;
  country_code?: string | null;
}

export interface OpenAlexAuthor {
  id: string;
  display_name?: string;
  display_name_alternatives?: string[];
  orcid?: string | null;
  works_count?: number;
  cited_by_count?: number;
  summary_stats?: { h_index?: number };
  affiliations?: Array<{
    institution?: OpenAlexInstitutionRef;
    years?: number[];
  }>;
  last_known_institutions?: OpenAlexInstitutionRef[];
  topics?: Array<{
    display_name?: string;
    count?: number;
    subfield?: { display_name?: string };
    field?: { display_name?: string };
  }>;
}

export interface OpenAlexInstitution {
  id: string;
  display_name?: string;
  geo?: {
    city?: string | null;
    region?: string | null;
    country_code?: string | null;
  };
}

export interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  primary_location?: {
    source?: { display_name?: string | null } | null;
  } | null;
  authorships?: Array<{
    author_position?: string;
    author?: { id?: string; display_name?: string };
  }>;
  cited_by_count?: number;
  is_retracted?: boolean;
  type?: string | null;
}

interface ListResponse<T> {
  results?: T[];
  meta?: { count?: number };
}

export interface OpenAlexClientOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  mailto?: string;
  baseUrl?: string;
}

const AUTHOR_FIELDS =
  'id,display_name,display_name_alternatives,orcid,works_count,cited_by_count,summary_stats,affiliations,last_known_institutions,topics';
const WORK_FIELDS =
  'id,doi,title,publication_year,publication_date,primary_location,authorships,cited_by_count,is_retracted,type';

/** Public OpenAlex API. A key and contact address are optional. */
export class OpenAlexClient {
  constructor(private readonly options: OpenAlexClientOptions) {}

  async searchAuthors(name: string): Promise<OpenAlexAuthor[]> {
    const body = await this.get<ListResponse<OpenAlexAuthor>>('authors', {
      search: name,
      per_page: '25',
      select: AUTHOR_FIELDS,
    });
    return body.results ?? [];
  }

  async institutions(ids: string[]): Promise<OpenAlexInstitution[]> {
    const short = [...new Set(ids.map(shortId).filter(Boolean))].slice(0, 50);
    if (short.length === 0) return [];
    const body = await this.get<ListResponse<OpenAlexInstitution>>(
      'institutions',
      {
        filter: `openalex:${short.join('|')}`,
        select: 'id,display_name,geo',
        per_page: '50',
      },
    );
    return body.results ?? [];
  }

  async works(
    authorId: string,
    options: { sort: string; perPage: number; retractedOnly?: boolean },
  ): Promise<{ works: OpenAlexWork[]; count: number }> {
    const filter = `author.id:${shortId(authorId)}${options.retractedOnly ? ',is_retracted:true' : ''}`;
    const body = await this.get<ListResponse<OpenAlexWork>>('works', {
      filter,
      sort: options.sort,
      per_page: String(options.perPage),
      select: WORK_FIELDS,
    });
    return { works: body.results ?? [], count: body.meta?.count ?? 0 };
  }

  private get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(
      `${(this.options.baseUrl ?? OPENALEX_API).replace(/\/$/, '')}/${path}`,
    );
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (this.options.apiKey)
      url.searchParams.set('api_key', this.options.apiKey);
    if (this.options.mailto)
      url.searchParams.set('mailto', this.options.mailto);
    return fetchJson<T>(url, {
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
    });
  }
}

/** "https://openalex.org/A123" -> "A123". */
export function shortId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//, '').trim();
}
