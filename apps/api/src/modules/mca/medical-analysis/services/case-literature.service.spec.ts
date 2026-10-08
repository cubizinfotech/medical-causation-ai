import type { MedicalLiteratureService } from '@integrations/medical-literature';
import { CaseLiteratureService } from './case-literature.service';
import {
  buildFallbackLiteratureRequest,
  parseLiteratureSuggestion,
  sanitizeLiteratureText,
} from './literature-query.helpers';

const caseRequest = {
  medicalQuestion:
    'Did the mild traumatic brain injury contribute to the ischemic stroke?',
  diagnosis:
    'Mild Traumatic Brain Injury (Concussion); Ischemic Stroke (diagnosed 5 months after the accident)',
  injury: 'Motor Vehicle Collision: rear-end collision at a traffic light',
};

describe('literature query helpers', () => {
  it('removes PubMed syntax, years and age phrases', () => {
    expect(
      sanitizeLiteratureText('"stroke"[tiab] AND 47-year-old after TBI 2024'),
    ).toBe('stroke after TBI');
  });

  it('accepts a valid suggested search and rejects junk', () => {
    expect(
      parseLiteratureSuggestion({
        exposureTerms: ['Concussion'],
        outcomeTerms: ['stroke'],
        queries: ['stroke risk after concussion', 'x'],
      }),
    ).toEqual({
      queries: ['stroke risk after concussion'],
      exposureTerms: ['concussion'],
      outcomeTerms: ['stroke'],
    });
    expect(parseLiteratureSuggestion('a string')).toBeNull();
    expect(parseLiteratureSuggestion({ queries: [] })).toBeNull();
    expect(parseLiteratureSuggestion(undefined)).toBeNull();
  });

  it('builds keyword queries from the diagnosis without case details', () => {
    expect(buildFallbackLiteratureRequest(caseRequest)).toEqual({
      queries: [
        'ischemic stroke after mild traumatic brain injury',
        'mild traumatic brain injury after motor vehicle collision',
        'ischemic stroke after motor vehicle collision',
      ],
      exposureTerms: ['mild traumatic brain injury', 'motor vehicle collision'],
      outcomeTerms: ['ischemic stroke', 'stroke'],
    });
    expect(
      buildFallbackLiteratureRequest({ medicalQuestion: 'q', diagnosis: '' }),
    ).toBeNull();
  });

  it('drops spinal levels and splits "with" in keyword queries', () => {
    const request = buildFallbackLiteratureRequest({
      medicalQuestion: 'q',
      diagnosis: 'Cervical disc herniation C5-C6 with radiculopathy',
      injury: 'Slip and Fall: fell on stairs',
    });
    expect(request?.queries).toEqual([
      'radiculopathy after cervical disc herniation',
      'cervical disc herniation after fall injury',
      'radiculopathy after fall injury',
    ]);
  });
});

describe('CaseLiteratureService', () => {
  function build(literature: Partial<MedicalLiteratureService>) {
    return new CaseLiteratureService({
      enabled: true,
      ...literature,
    } as MedicalLiteratureService);
  }

  const article = {
    pmid: '111',
    title: 'Risk of stroke after traumatic brain injury',
    authors: ['A', 'B', 'C', 'D'],
    journal: 'Neurology',
    year: 2023,
    publicationTypes: ['Meta-Analysis'],
    evidenceType: 'meta_analysis' as const,
    matchedQueries: [],
    pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/111/',
  };

  const empty = { articles: [], abstractsAvailable: false, failedQueries: [] };

  it("searches with the analysis model's suggested queries", async () => {
    const search = jest.fn().mockResolvedValue({
      articles: [article],
      abstractsAvailable: true,
      failedQueries: [],
    });

    const result = await build({ search }).research(caseRequest, {
      exposureTerms: ['concussion'],
      outcomeTerms: ['stroke'],
      queries: ['stroke risk after concussion'],
    });

    expect(search).toHaveBeenCalledWith({
      queries: ['stroke risk after concussion'],
      exposureTerms: ['concussion'],
      outcomeTerms: ['stroke'],
    });
    expect(result.summary).toMatchObject({
      status: 'completed',
      queryMethod: 'ai',
      queries: ['stroke risk after concussion'],
      abstractsAvailable: true,
    });
    expect(result.references[0]).toMatchObject({
      id: 'pmid-111',
      source: 'PubMed',
      authors: 'A, B, C, et al.',
      publicationType: 'Meta-analysis',
    });
  });

  it('falls back to keyword queries when no usable suggestion came back', async () => {
    const search = jest.fn().mockResolvedValue(empty);
    const result = await build({ search }).research(caseRequest, {
      queries: [],
    });

    expect(result.summary).toMatchObject({
      status: 'no_results',
      queryMethod: 'keywords',
      queries: [
        'ischemic stroke after mild traumatic brain injury',
        'mild traumatic brain injury after motor vehicle collision',
        'ischemic stroke after motor vehicle collision',
      ],
    });
  });

  it('reports PubMed outages instead of failing the analysis', async () => {
    const search = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await build({ search }).research(caseRequest);

    expect(result.summary.status).toBe('unavailable');
    expect(result.references).toEqual([]);
  });

  it('does nothing when the feature is turned off', async () => {
    const search = jest.fn();
    const result = await build({ enabled: false, search }).research(
      caseRequest,
    );

    expect(result.summary.status).toBe('disabled');
    expect(search).not.toHaveBeenCalled();
  });
});
