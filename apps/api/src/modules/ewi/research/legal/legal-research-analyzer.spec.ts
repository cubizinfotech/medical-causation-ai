import {
  buildLegalResearchDossier,
  findTestimonyContradictions,
  prioritizeOrders,
} from './legal-research-analyzer';
import type { ExpertEvidenceItem } from '@integrations/expert-research';

function item(
  partial: Pick<ExpertEvidenceItem, 'sourceId' | 'category' | 'title'> &
    Partial<ExpertEvidenceItem>,
): ExpertEvidenceItem {
  return {
    summary: 'Collected legal statement',
    access: 'public',
    informationStatus: 'unverified',
    identityMatch: 'matched',
    ...partial,
  };
}

const CREDIBILITY_CLAIM = /not credible|lacks credibility|fraudulent/i;

describe('legal research analyzer', () => {
  it('prioritizes orders that limit or strike the expert and keeps chronology for ties', () => {
    const orders = prioritizeOrders(
      buildLegalResearchDossier({
        evidence: [
          item({
            sourceId: 'orders',
            category: 'court_order',
            title: 'Scheduling order',
            url: 'https://example.local/scheduling',
            raw: {
              documentType: 'order',
              documentDate: '2018-01-01',
              orderTags: [],
              findingsRegardingExpert: 'Does not address the expert.',
            },
          }),
          item({
            sourceId: 'orders',
            category: 'court_order',
            title: 'Order limiting testimony',
            url: 'https://example.local/limit',
            raw: {
              documentType: 'order',
              documentDate: '2018-06-01',
              orderTags: ['limits_expert', 'restricts_testimony'],
              findingsRegardingExpert:
                'Limits testimony on causation. No credibility determination is stated.',
            },
          }),
          item({
            sourceId: 'orders',
            category: 'court_order',
            title: 'Order striking expert',
            url: 'https://example.local/strike',
            raw: {
              documentType: 'order',
              documentDate: '2019-01-01',
              orderTags: ['strikes_expert', 'sanctions'],
              findingsRegardingExpert: 'Strikes the expert as a witness.',
            },
          }),
        ],
      }).matters.filter((matter) => matter.documentType === 'order'),
    );

    expect(orders.map((entry) => entry.matter.title)).toEqual([
      'Order striking expert',
      'Order limiting testimony',
      'Scheduling order',
    ]);
    expect(orders[0]?.significanceTags).toEqual(
      expect.arrayContaining(['strikes_expert', 'sanctions']),
    );
    expect(
      orders.map((entry) => entry.matter.findingsRegardingExpert).join(' '),
    ).not.toMatch(
      /\blacks credibility\b|\bfraudulent\b|found the expert not credible/i,
    );
  });

  it('lists motions and pleadings chronologically with short descriptions', () => {
    const dossier = buildLegalResearchDossier({
      evidence: [
        item({
          sourceId: 'motions',
          category: 'motion',
          title: 'Motion to exclude',
          raw: {
            documentType: 'motion',
            filingDate: '2018-03-01',
            shortDescription: 'Seeks to exclude the expert.',
          },
        }),
        item({
          sourceId: 'pleadings',
          category: 'motion',
          title: 'Complaint',
          raw: {
            documentType: 'pleading',
            filingDate: '2017-09-01',
            shortDescription: 'Complaint naming the parties.',
          },
        }),
      ],
    });

    expect(
      dossier.motionsAndPleadings.map((entry) => entry.matter.title),
    ).toEqual(['Complaint', 'Motion to exclude']);
    expect(dossier.motionsAndPleadings[0]?.description).toBe(
      'Complaint naming the parties.',
    );
  });

  it('stores deposition metadata and compares contradictory testimony only from collected statements', () => {
    const dossier = buildLegalResearchDossier({
      evidence: [
        item({
          sourceId: 'depositions',
          category: 'deposition',
          title: 'Deposition 2019',
          access: 'restricted',
          summary: '',
          url: 'https://example.local/depo',
          raw: {
            documentType: 'deposition',
            caseName: 'Sample v. Sample',
            documentDate: '2019-05-01',
            transcriptMetadata: 'Pages 1-40',
            shortDescription: 'Deposition of the expert.',
            importantStatements: ['Date of examination was March 2016.'],
            metadataOnly: true,
          },
        }),
        item({
          sourceId: 'expert_testimony',
          category: 'testimony',
          title: 'Trial testimony 2021',
          url: 'https://example.local/trial',
          raw: {
            documentType: 'testimony',
            documentDate: '2021-02-03',
            importantStatements: ['Date of examination was October 2017.'],
            findingsRegardingExpert:
              'Records the stated examination date. Does not state a credibility finding.',
          },
        }),
      ],
      sourceResults: [
        {
          sourceId: 'state_court_records',
          status: 'unavailable',
          outcome: 'unavailable',
          access: 'unavailable',
          message: 'No adapter connected.',
          retrievedAt: '2026-09-29T00:00:00.000Z',
          items: [],
        },
      ],
      legalProviderIds: [
        'depositions',
        'expert_testimony',
        'state_court_records',
      ],
    });

    expect(dossier.depositions[0]).toMatchObject({
      caseName: 'Sample v. Sample',
      date: '2019-05-01',
      sourceLink: 'https://example.local/depo',
      transcriptMetadata: 'Pages 1-40',
      summary: 'Deposition of the expert.',
    });
    expect(dossier.testimonyContradictions).toHaveLength(1);
    expect(dossier.testimonyContradictions[0]?.description).toMatch(
      /March 2016/,
    );
    expect(dossier.testimonyContradictions[0]?.description).toMatch(
      /October 2017/,
    );
    expect(dossier.testimonyContradictions[0]?.description).not.toMatch(
      CREDIBILITY_CLAIM,
    );
    expect(dossier.sourceAttempts[0]).toMatchObject({
      sourceId: 'state_court_records',
      status: 'unavailable',
    });
  });

  it('does not invent a contradiction when statements agree', () => {
    const contradictions = findTestimonyContradictions(
      buildLegalResearchDossier({
        evidence: [
          item({
            sourceId: 'expert_testimony',
            category: 'testimony',
            title: 'A',
            raw: {
              documentType: 'testimony',
              importantStatements: ['Board certified in Neurology.'],
            },
          }),
          item({
            sourceId: 'expert_testimony',
            category: 'testimony',
            title: 'B',
            raw: {
              documentType: 'testimony',
              importantStatements: ['Board certified in Neurology.'],
            },
          }),
        ],
      }).matters,
    );
    expect(contradictions).toEqual([]);
  });

  it('does not treat an uncertain identity record as the expert’s legal matter', () => {
    const dossier = buildLegalResearchDossier({
      evidence: [
        item({
          sourceId: 'courtlistener',
          category: 'legal',
          title: 'Other person case',
          identityMatch: 'uncertain',
          raw: {
            documentType: 'case',
            caseName: 'Other v. Other',
          },
        }),
      ],
    });
    expect(dossier.matters).toEqual([]);
  });
});
