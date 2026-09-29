import { buildDeterministicAnalysis } from './deterministic-analysis';
import { EwiAnalysisService } from './ewi-analysis.service';
import type { AnalysisPacket } from './ewi-analysis.types';
import {
  EWI_ANALYSIS_SECTIONS,
  MIN_LEADING_QUESTIONS,
} from './ewi-analysis.types';
import {
  AnalysisValidationError,
  applyAiWording,
  assertGrounded,
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

function groundedQuestionBank(count = MIN_LEADING_QUESTIONS) {
  return Array.from({ length: count }, (_, index) => ({
    category: index % 2 === 0 ? 'publication' : 'identity',
    question:
      index % 2 === 0
        ? 'What supports Development fixture: sample citation from finding f1?'
        : 'What alternate identity documentation exists beyond source:orcid?',
    sourceRefs: index % 2 === 0 ? ['f1'] : ['source:orcid'],
    ...(index % 2 === 1
      ? {
          uncertaintyNote:
            'Source was unavailable; the question must not assume a negative finding.',
        }
      : {}),
  }));
}

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
      questions: groundedQuestionBank(),
    });

    expect(() => validateAiAnalysis(raw, packet)).toThrow(
      /qualification or channel|number that was not collected/i,
    );
  });

  it('rejects invented income, case citations, and statistics', () => {
    const raw = JSON.stringify({
      summary: 'Could not verify the collected citation.',
      conclusions: [
        {
          text: 'Expert earned $450,000 in case 2:21-cv-12345 and won 87% of matters.',
          sourceRefs: ['f1'],
        },
      ],
      questions: groundedQuestionBank(),
    });

    expect(() => validateAiAnalysis(raw, packet)).toThrow(
      AnalysisValidationError,
    );
  });

  it('rejects invented quotes and testimony phrasing', () => {
    const raw = JSON.stringify({
      summary: 'Could not verify the collected citation.',
      conclusions: [
        {
          text: 'The expert testified that "I never review imaging" in deposition.',
          sourceRefs: ['f1'],
        },
      ],
      questions: groundedQuestionBank(),
    });

    expect(() => validateAiAnalysis(raw, packet)).toThrow(
      /quote|qualification or channel|unsupported/i,
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
        ...groundedQuestionBank(MIN_LEADING_QUESTIONS - 1),
      ],
    });

    expect(() => validateAiAnalysis(raw, packet)).toThrow(
      /not a collected source/i,
    );
  });

  it('rejects fewer than 100 questions', () => {
    const raw = JSON.stringify({
      summary: 'Could not verify Development fixture: sample citation.',
      conclusions: [
        {
          text: 'Could not verify Development fixture: sample citation.',
          sourceRefs: ['f1'],
        },
      ],
      questions: groundedQuestionBank(10),
    });

    expect(() => validateAiAnalysis(raw, packet)).toThrow(/at least 100/i);
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
      sectionSummaries: [
        {
          section: 'publications',
          text: 'Publication findings include Development fixture: sample citation.',
          status: 'not_verified',
          sourceRefs: ['f1', 'https://pubmed.example.local/000000'],
          findingKeys: ['f1'],
        },
      ],
      investigationFindings: [
        {
          text: 'Could not verify Development fixture: sample citation.',
          status: 'not_verified',
          sourceRefs: ['f1'],
        },
      ],
      questions: groundedQuestionBank(),
    });

    const wording = validateAiAnalysis(raw, packet);
    expect(wording.questions.length).toBeGreaterThanOrEqual(
      MIN_LEADING_QUESTIONS,
    );
    expect(wording.questions[0]?.sourceRefs).toEqual(['f1']);
    expect(wording.sectionSummaries?.[0]?.section).toBe('publications');
  });
});

describe('assertGrounded', () => {
  const corpus = corpusForPacket(packet);

  it('rejects court findings and social channels absent from the packet', () => {
    expect(() =>
      assertGrounded(
        'The court found negligence and the LinkedIn profile proves bias.',
        corpus,
      ),
    ).toThrow(AnalysisValidationError);
  });
});

describe('buildDeterministicAnalysis', () => {
  it('groups findings, keeps them not verified, and does not invent an ORCID record', () => {
    const document = buildDeterministicAnalysis(packet);
    expect(document.groups).toEqual([
      { category: 'publication', findingKeys: ['f1'] },
    ]);
    expect(document.assessments[0]?.assessment).toBe('not_verified');
    expect(document.summary).toMatch(/could not be verified/i);
    expect(document.missing[0]?.assessment).toBe('unavailable');
    expect(document.sectionSummaries).toHaveLength(
      EWI_ANALYSIS_SECTIONS.length,
    );
    expect(document.questions.length).toBeGreaterThanOrEqual(
      MIN_LEADING_QUESTIONS,
    );
    expect(JSON.stringify(document)).not.toMatch(
      /holds a phd|board-certified/i,
    );
    expect(document.questions.every((item) => item.sourceRefs.length > 0)).toBe(
      true,
    );
  });

  it('covers required analysis sections without inventing evidence', () => {
    const document = buildDeterministicAnalysis(packet);
    const bySection = new Map(
      document.sectionSummaries.map((s) => [s.section, s]),
    );
    expect(bySection.get('publications')?.findingKeys).toEqual(['f1']);
    expect(bySection.get('legal_matters')?.status).toBe('not_found');
    expect(bySection.get('social_media')?.text).toMatch(/no social media/i);
    expect(bySection.get('income_bias')?.status).toBe('not_found');
  });
});

describe('applyAiWording', () => {
  it('keeps deterministic assessments while applying validated wording', () => {
    const document = buildDeterministicAnalysis(packet);
    const wording = validateAiAnalysis(
      JSON.stringify({
        summary: 'Could not verify Development fixture: sample citation.',
        conclusions: [
          {
            text: 'Could not verify Development fixture: sample citation.',
            sourceRefs: ['f1'],
          },
        ],
        questions: groundedQuestionBank(),
      }),
      packet,
    );
    const merged = applyAiWording(document, wording);
    expect(merged.assessments[0]?.assessment).toBe('not_verified');
    expect(merged.summary).toBe(wording.summary);
    expect(merged.questions.length).toBeGreaterThanOrEqual(
      MIN_LEADING_QUESTIONS,
    );
  });
});

describe('EwiAnalysisService', () => {
  it('discards malformed model output and keeps the collected-finding analysis', async () => {
    const service = new EwiAnalysisService(aiReturning('not json'));
    const record = await service.interpret(packet);
    expect(record.origin).toBe('deterministic');
    expect(record.document.assessments[0]?.assessment).toBe('not_verified');
    expect(record.document.summary).not.toMatch(/phd/i);
    expect(record.document.questions.length).toBeGreaterThanOrEqual(
      MIN_LEADING_QUESTIONS,
    );
  });

  it('discards hallucinated model output', async () => {
    const service = new EwiAnalysisService(
      aiReturning(
        JSON.stringify({
          summary: 'Expert is board-certified and earned $900,000 last year.',
          conclusions: [
            {
              text: 'Court found the expert unreliable in 2:19-cv-00001.',
              sourceRefs: ['f1'],
            },
          ],
          questions: groundedQuestionBank(),
        }),
      ),
    );
    const record = await service.interpret(packet);
    expect(record.origin).toBe('deterministic');
    expect(record.document.summary).not.toMatch(/\$900,000|board-certified/i);
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
          questions: groundedQuestionBank(),
        }),
      ),
    );
    const record = await service.interpret(packet);
    expect(record.origin).toBe('ai');
    expect(record.providerName).toBe('test-provider');
    expect(record.document.assessments[0]?.assessment).toBe('not_verified');
    expect(record.document.questions.length).toBeGreaterThanOrEqual(
      MIN_LEADING_QUESTIONS,
    );
  });
});

function corpusForPacket(p: AnalysisPacket): string {
  return [
    p.expertName,
    p.specialty,
    JSON.stringify(p.findings),
    JSON.stringify(p.sourceAttempts),
    'could not verify',
  ]
    .join('\n')
    .toLowerCase();
}

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
