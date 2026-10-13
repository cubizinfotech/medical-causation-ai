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
    expect(result?.warnings).toEqual([
      expect.stringMatching(/AI provider was busy.*CV page 1/),
    ]);
  });
});
