import type { LiteratureSearchSettings } from '@config/config.types';
import type { EuropePmcAbstract } from './medical-literature.types';

type FetchLike = typeof fetch;

interface EuropePmcResult {
  pmid?: string;
  pmcid?: string;
  abstractText?: string;
  isOpenAccess?: string;
}

/**
 * Europe PMC mirrors PubMed and returns abstracts as JSON, which PubMed's
 * own API only offers as XML. Used for abstracts and open-access status.
 */
export class EuropePmcClient {
  constructor(
    private readonly settings: LiteratureSearchSettings,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async abstracts(pmids: string[]): Promise<Map<string, EuropePmcAbstract>> {
    const abstracts = new Map<string, EuropePmcAbstract>();
    const ids = pmids.filter((id) => /^\d+$/.test(id));
    if (ids.length === 0) return abstracts;

    const url = new URL(
      `${this.settings.europePmcBaseUrl.replace(/\/$/, '')}/search`,
    );
    url.searchParams.set(
      'query',
      `(${ids.map((id) => `EXT_ID:${id}`).join(' OR ')}) AND SRC:MED`,
    );
    url.searchParams.set('resultType', 'core');
    url.searchParams.set('format', 'json');
    url.searchParams.set('pageSize', String(ids.length));

    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(this.settings.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Europe PMC returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      resultList?: { result?: EuropePmcResult[] };
    };
    for (const result of payload.resultList?.result ?? []) {
      if (!result.pmid || !result.abstractText) continue;
      abstracts.set(result.pmid, {
        abstractHtml: result.abstractText,
        pmcid: result.pmcid,
        isOpenAccess: result.isOpenAccess === 'Y',
      });
    }
    return abstracts;
  }
}
