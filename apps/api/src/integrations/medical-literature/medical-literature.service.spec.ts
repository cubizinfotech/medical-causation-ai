import type { LiteratureSearchSettings } from '@config/config.types';
import { EuropePmcClient } from './europe-pmc.client';
import { MedicalLiteratureService } from './medical-literature.service';
import { PubMedClient } from './pubmed.client';

const settings: LiteratureSearchSettings = {
  enabled: true,
  pubmedBaseUrl: 'https://pubmed.test/eutils',
  europePmcBaseUrl: 'https://epmc.test/rest',
  tool: 'medical-causation-ai',
  maxResults: 5,
  resultsPerQuery: 10,
  timeoutMs: 1000,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const esummary = {
  result: {
    uids: ['111', '222'],
    '111': {
      uid: '111',
      title: 'Risk of stroke after traumatic brain injury',
      pubdate: '2023 Jan',
      fulljournalname: 'Neurology',
      authors: [
        { name: 'Smith J', authtype: 'Author' },
        { name: 'Lee K', authtype: 'Author' },
      ],
      pubtype: ['Journal Article', 'Meta-Analysis'],
      articleids: [
        { idtype: 'doi', value: '10.1/abc' },
        { idtype: 'pmc', value: 'PMC1' },
      ],
      attributes: ['Has Abstract'],
      lang: ['eng'],
    },
    '222': {
      uid: '222',
      title: 'Retracted: stroke and concussion',
      pubtype: ['Retracted Publication'],
      attributes: ['Has Abstract'],
      lang: ['eng'],
    },
  },
};

describe('MedicalLiteratureService', () => {
  function build(fetchImpl: jest.Mock) {
    const fetchFn = fetchImpl as unknown as typeof fetch;
    return new MedicalLiteratureService(
      settings,
      new PubMedClient(settings, fetchFn),
      new EuropePmcClient(settings, fetchFn),
    );
  }

  const request = {
    queries: ['stroke risk after traumatic brain injury'],
    exposureTerms: ['traumatic brain injury'],
    outcomeTerms: ['stroke'],
  };

  it('searches PubMed by relevance and returns linked, ranked articles', async () => {
    const fetchImpl = jest.fn((url: URL) => {
      if (url.pathname.endsWith('esearch.fcgi')) {
        return Promise.resolve(
          json({ esearchresult: { count: '2', idlist: ['222', '111'] } }),
        );
      }
      if (url.pathname.endsWith('esummary.fcgi')) {
        return Promise.resolve(json(esummary));
      }
      return Promise.resolve(
        json({
          resultList: {
            result: [
              {
                pmid: '111',
                pmcid: 'PMC1',
                isOpenAccess: 'Y',
                abstractText: '<h4>Conclusions</h4>TBI raised stroke risk.',
              },
            ],
          },
        }),
      );
    });

    const result = await build(fetchImpl).search(request);

    const searchUrl = fetchImpl.mock.calls[0][0];
    expect(searchUrl.searchParams.get('sort')).toBe('relevance');
    expect(searchUrl.searchParams.get('tool')).toBe('medical-causation-ai');
    expect(searchUrl.searchParams.get('term')).toBe(request.queries[0]);

    expect(result.abstractsAvailable).toBe(true);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]).toMatchObject({
      pmid: '111',
      year: 2023,
      evidenceType: 'meta_analysis',
      doi: '10.1/abc',
      authors: ['Smith J', 'Lee K'],
      abstractExcerpt: 'TBI raised stroke risk.',
      pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/111/',
      fullTextUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1/',
    });
  });

  it('still returns articles when Europe PMC is down', async () => {
    const fetchImpl = jest.fn((url: URL) => {
      if (url.pathname.endsWith('esearch.fcgi')) {
        return Promise.resolve(
          json({ esearchresult: { count: '1', idlist: ['111'] } }),
        );
      }
      if (url.pathname.endsWith('esummary.fcgi')) {
        return Promise.resolve(json(esummary));
      }
      return Promise.resolve(json({}, 503));
    });

    const result = await build(fetchImpl).search(request);
    expect(result.abstractsAvailable).toBe(false);
    expect(result.articles[0].abstractExcerpt).toBeUndefined();
  });

  it('retries once on a PubMed rate limit', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(
        json({ esearchresult: { count: '0', idlist: [] } }),
      );

    const result = await build(fetchImpl).search(request);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.articles).toEqual([]);
  });

  it('retries once after a network error', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        json({ esearchresult: { count: '0', idlist: [] } }),
      );

    await build(fetchImpl).search(request);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws when every query fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(json({}, 400));
    await expect(build(fetchImpl).search(request)).rejects.toThrow('HTTP 400');
  });
});
