import { buildDeterministicAnalysis } from './deterministic-analysis';
import { EwiAnalysisService } from './ewi-analysis.service';
import type { AnalysisPacket } from './ewi-analysis.types';
import {
  AnalysisValidationError,
  validateAiAnalysis,
} from './validate-ai-analysis';

const packet: AnalysisPacket = {
  expertName: 'Jane Smith',
  specialty: 'Orthopedics',
  findings: [
    {
      findingKey: 'f1',
      category: 'publication',
      title: 'Development fixture: sample citation',
      summary: 'Development fixture only.',
      url: 'https://pubmed.example.local/000000',
      providerId: 'pubmed',
      informationStatus: 'unverified',
      access: 'public',
    },
  ],
  sourceAttempts: [
    {
      sourceRef: 'source:orcid',
      providerId: 'orcid',
      category: 'identity',
      status: 'unavailable',
      access: 'unavailable',
      itemCount: 0,
    },
  ],
};

describe('validateAiAnalysis', () => {
  it('rejects malformed JSON', () => {
    expect(() => validateAiAnalysis('not json', packet)).toThrow(
      AnalysisValidationError,
    );
  });

  it('rejects a conclusion that invents a degree and a publication', () => {
    const raw = JSON.stringify({
      summary: 'Could not verify the collected citation.',
      conclusions: [
        {
          text: 'Jane Smith holds a PhD and published Outcomes in Orthopedics, PMID 999999.',
          sourceRefs: ['f1'],
        },
      ],
      questions: [
        {
          category: 'publication',
          question: 'What supports the collected citation?',
          sourceRefs: ['f1'],
        },
      ],
    });

    expect(() => validateAiAnalysis(raw, packet)).toThrow(
      /qualification or channel|number that was not collected/i,
    );
  });

  it('rejects a question that cites a source that was not collected', () => {
    const raw = JSON.stringify({
      summary: 'Could not verify the collected citation.',
      conclusions: [
        {
          text: 'Could not verify Development fixture: sample citation.',
          sourceRefs: ['f1'],
        },
      ],
      questions: [
        {
          category: 'publication',
          question: 'Explain the LinkedIn post.',
          sourceRefs: ['f99'],
        },
      ],
    });

    expect(() => validateAiAnalysis(raw, packet)).toThrow(
      /not a collected source/i,
    );
  });

  it('accepts wording that only restates collected findings', () => {
    const raw = JSON.stringify({
      summary:
        'Could not verify Development fixture: sample citation from pubmed.',
      conclusions: [
        {
          text: 'Could not verify Development fixture: sample citation.',
          sourceRefs: ['f1'],
        },
      ],
      questions: [
        {
          category: 'publication',
          question:
            'What supports Development fixture: sample citation at https://pubmed.example.local/000000?',
          sourceRefs: ['f1'],
        },
      ],
    });

    const wording = validateAiAnalysis(raw, packet);
    expect(wording.questions).toHaveLength(1);
    expect(wording.questions[0]?.sourceRefs).toEqual(['f1']);
  });
});

describe('buildDeterministicAnalysis', () => {
  it('groups findings, keeps them unverified, and does not invent an ORCID record', () => {
    const document = buildDeterministicAnalysis(packet);
    expect(document.groups).toEqual([
      { category: 'publication', findingKeys: ['f1'] },
    ]);
    expect(document.assessments[0]?.assessment).toBe('unverified');
    expect(document.summary).toMatch(/could not be verified/i);
    expect(document.missing[0]?.assessment).toBe('restricted_unavailable');
    expect(JSON.stringify(document)).not.toMatch(
      /holds a phd|board-certified/i,
    );
    expect(document.questions.every((item) => item.sourceRefs.length > 0)).toBe(
      true,
    );
  });
});

describe('EwiAnalysisService', () => {
  it('discards malformed model output and keeps the collected-finding analysis', async () => {
    const service = new EwiAnalysisService(aiReturning('not json'));
    const record = await service.interpret(packet);
    expect(record.origin).toBe('deterministic');
    expect(record.document.assessments[0]?.assessment).toBe('unverified');
    expect(record.document.summary).not.toMatch(/phd/i);
  });

  it('keeps source assessments when the model wording is grounded', async () => {
    const service = new EwiAnalysisService(
      aiReturning(
        JSON.stringify({
          summary: 'Could not verify Development fixture: sample citation.',
          conclusions: [
            {
              text: 'Could not verify Development fixture: sample citation.',
              sourceRefs: ['f1'],
            },
          ],
          questions: [
            {
              category: 'publication',
              question: 'What supports Development fixture: sample citation?',
              sourceRefs: ['f1'],
            },
          ],
        }),
      ),
    );
    const record = await service.interpret(packet);
    expect(record.origin).toBe('ai');
    expect(record.providerName).toBe('test-provider');
    expect(record.document.assessments[0]?.assessment).toBe('unverified');
    expect(record.document.questions).toHaveLength(1);
  });
});

function aiReturning(content: string) {
  return {
    getActiveLlmProvider: () => ({
      name: 'test-provider',
      isAvailable: () => true,
    }),
    loadPrompt: () => Promise.resolve({ content: 'system' }),
    complete: () => Promise.resolve({ content }),
  } as unknown as ConstructorParameters<typeof EwiAnalysisService>[0];
}
