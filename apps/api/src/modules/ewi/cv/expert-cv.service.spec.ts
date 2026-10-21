import { RateLimitExceededException } from '@ai/exceptions';
import type { LoadedExpertDocument } from '../documents/expert-documents.types';
import { ExpertCvService } from './expert-cv.service';

const PAGE =
  'JANE A. SMITH, MD. Board Certified, American Board of Neurological Surgery, 2006. Medical licenses: California A12345.';

const document: LoadedExpertDocument = {
  id: 'doc-1',
  kind: 'cv',
  name: 'smith-cv.pdf',
  pageCount: 1,
  unreadablePages: [],
  ocrPages: [],
  pages: [{ pageNumber: 1, text: PAGE, ocrConfidence: null }],
};

const REPLY = JSON.stringify({
  claims: [
    {
      category: 'license',
      statement: 'Licensed in California',
      details: { state: 'California', licenseNumber: 'A12345' },
      page: 1,
      quote: 'Medical licenses: California A12345',
    },
  ],
});

function build(complete: jest.Mock) {
  const ai = {
    complete,
    loadPrompt: jest.fn().mockResolvedValue({ content: 'system' }),
    getActiveLlmProvider: () => ({ isAvailable: () => true }),
  };
  const documents = {
    readScannedPages: jest.fn().mockResolvedValue({ attempted: 0, read: 0 }),
    loadDocument: jest.fn().mockResolvedValue(document),
    batchChars: 12000,
  };
  return new ExpertCvService(ai as never, documents as never);
}

describe('ExpertCvService', () => {
  it('waits out a provider rate limit and still reads the claims', async () => {
    const complete = jest
      .fn()
      .mockRejectedValueOnce(new RateLimitExceededException('mistral', 1))
      .mockResolvedValueOnce({ content: REPLY });

    const result = await build(complete).extract('doc-1', 'Jane Smith');

    expect(complete).toHaveBeenCalledTimes(2);
    expect(result?.status).toBe('completed');
    expect(result?.claims).toHaveLength(1);
    expect(result?.warnings).toEqual([]);
  });

  it('says the AI provider was busy, not that the PDF is unreadable', async () => {
    const complete = jest
      .fn()
      .mockRejectedValue(new RateLimitExceededException('mistral', 1));

    const result = await build(complete).extract('doc-1', 'Jane Smith');

    expect(complete).toHaveBeenCalledTimes(3);
    expect(result?.status).toBe('failed');
    expect(result?.incompletePages).toEqual([1]);
    expect(result?.warnings).toEqual([
      expect.stringMatching(/AI provider was busy.*CV page 1/),
      expect.stringMatching(/unread or partially extracted: 1/),
    ]);
  });

  it('retries a failed CV section once and recovers', async () => {
    const complete = jest
      .fn()
      .mockRejectedValueOnce(new Error('model timeout'))
      .mockResolvedValueOnce({ content: REPLY });

    const result = await build(complete).extract('doc-1', 'Jane Smith');

    expect(complete).toHaveBeenCalledTimes(2);
    expect(result?.status).toBe('completed');
    expect(result?.incompletePages).toBeUndefined();
    expect(result?.claims).toHaveLength(1);
  });

  it('keeps numbered publications when pages 6-9 cannot be finished', async () => {
    const longPage =
      'PUBLICATIONS 1. Smith JA (2015). Migraine outcomes after cervical fusion. Spine, 1, 1-2.';
    const complete = jest.fn().mockRejectedValue(new Error('model timeout'));
    const ai = {
      complete,
      loadPrompt: jest.fn().mockResolvedValue({ content: 'system' }),
      getActiveLlmProvider: () => ({ isAvailable: () => true }),
    };
    const documents = {
      readScannedPages: jest.fn().mockResolvedValue({ attempted: 0, read: 0 }),
      loadDocument: jest.fn().mockResolvedValue({
        ...document,
        pageCount: 9,
        pages: [
          { pageNumber: 6, text: longPage, ocrConfidence: null },
          {
            pageNumber: 7,
            text: `${longPage} Second entry.`,
            ocrConfidence: null,
          },
          {
            pageNumber: 8,
            text: `${longPage} Third entry.`,
            ocrConfidence: null,
          },
          {
            pageNumber: 9,
            text: `${longPage} Fourth entry.`,
            ocrConfidence: null,
          },
        ],
      }),
      batchChars: 12000,
    };

    const result = await new ExpertCvService(
      ai as never,
      documents as never,
    ).extract('doc-1', 'Jane Smith');

    expect(result?.status).toBe('partial');
    expect(result?.incompletePages).toEqual([6, 7, 8, 9]);
    expect(
      result?.claims.some(
        (claim) =>
          claim.category === 'publication' &&
          claim.details.title?.includes('Migraine outcomes'),
      ),
    ).toBe(true);
    expect(result?.warnings.join(' ')).toMatch(
      /unread or partially extracted: 6, 7, 8, 9/,
    );
    expect(result?.warnings.join(' ')).toMatch(/was not fully reviewed/);
  });
});
