import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ConfigService } from '@nestjs/config';
import type { EwiRequestWorkflowService } from '../../correspondence/ewi-request-workflow.service';
import type { ExpertDocumentsService } from '../../documents/expert-documents.service';
import type { EwiPdfReportService } from '../../report/ewi-pdf-report.service';
import type { EwiWordReportService } from '../../report/ewi-word-report.service';
import { EWI_REPORT_TEMPLATE_VERSION } from '../../report/ewi-report.version';
import type {
  ExpertInvestigationRepository,
  InvestigationView,
} from '../repositories/expert-investigation.repository';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';
import { InvestigationHistoryService } from './investigation-history.service';

const WORD_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('InvestigationHistoryService reports', () => {
  let root: string;
  let wordFile: string;
  let pdfFile: string;
  const updateReportFile = jest.fn().mockResolvedValue(undefined);
  const markCompleted = jest.fn().mockResolvedValue(null);
  const build = jest.fn();
  const buildSourceLinks = jest.fn();
  const buildWord = jest.fn();

  function service(
    row: Partial<InvestigationView> = {},
    options: { owned?: boolean } = {},
  ) {
    const owned = options.owned !== false;
    return new InvestigationHistoryService(
      {
        findOwned: () =>
          Promise.resolve(
            owned
              ? {
                  id: 'inv-1',
                  reportFileName: 'ewi-report.docx',
                  reportMimeType: WORD_MIME,
                  reportStorageKey: wordFile,
                  result: { expertName: 'Jane Doe' } as EwiInvestigationResult,
                  ...row,
                }
              : null,
          ),
        findByJobId: () => Promise.resolve({ id: 'inv-2' }),
        updateReportFile,
        markCompleted,
      } as unknown as ExpertInvestigationRepository,
      {
        get: () => ({ products: { ewi: { reports: root } } }),
      } as unknown as ConfigService,
      {} as EwiRequestWorkflowService,
      {} as ExpertDocumentsService,
      { build, buildSourceLinks } as unknown as EwiPdfReportService,
      { build: buildWord } as unknown as EwiWordReportService,
    );
  }

  function rebuiltPdf(content = 'rebuilt report') {
    return {
      fileName: 'ewi-jane-doe-report.pdf',
      mimeType: 'application/pdf',
      format: 'pdf',
      buffer: Buffer.from(content),
      templateId: 'ewi/investigation-report',
      templateVersion: EWI_REPORT_TEMPLATE_VERSION,
    };
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ewi-reports-'));
    mkdirSync(join(root, 'investigations'));
    wordFile = join(root, 'investigations', 'job-1.docx');
    pdfFile = join(root, 'investigations', 'job-1.pdf');
    writeFileSync(wordFile, 'saved word report');
    updateReportFile.mockClear();
    markCompleted.mockClear();
    build.mockReset();
    buildSourceLinks.mockReset();
    buildWord.mockReset();
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('replaces a Word report saved before the PDF template with the PDF', async () => {
    build.mockResolvedValue(rebuiltPdf());

    const report = await service({ reportTemplateVersion: '2.2.0' }).getReport(
      'inv-1',
      'user-1',
    );

    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ expertName: 'Jane Doe' }),
    );
    expect(report).toEqual({
      fileName: 'ewi-jane-doe-report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('rebuilt report'),
    });
    expect(readFileSync(pdfFile, 'utf8')).toBe('rebuilt report');
    expect(existsSync(wordFile)).toBe(false);
    expect(updateReportFile).toHaveBeenCalledWith('inv-1', {
      fileName: 'ewi-jane-doe-report.pdf',
      mimeType: 'application/pdf',
      storageKey: pdfFile,
      byteSize: 'rebuilt report'.length,
      templateVersion: EWI_REPORT_TEMPLATE_VERSION,
    });
  });

  it('rebuilds an outdated PDF without mutating stored investigation evidence', async () => {
    writeFileSync(pdfFile, 'older pdf');
    build.mockResolvedValue(rebuiltPdf('newer pdf'));
    const result = {
      expertName: 'Jane Doe',
      city: 'Boston',
      specialty: 'Neurology',
      evidence: [
        {
          sourceId: 'npi_registry',
          category: 'license',
          title: 'NPI record',
          summary: 'License PSY12345 is active.',
        },
      ],
      discrepancies: [
        {
          id: 'd1',
          title: 'Stored discrepancy',
          description: 'Keep this row.',
        },
      ],
      questions: [
        {
          number: 1,
          category: 'Background and credentials',
          question: 'Is license PSY12345 current?',
          evidenceBasis: 'NPI Registry record for PSY12345',
          label: 'verified' as const,
          sources: [],
        },
      ],
      questionCount: 1,
      sourceStatuses: [],
      generatedAt: '2026-10-19T12:00:00.000Z',
    };
    const before = JSON.stringify(result);

    await service({
      reportFileName: 'ewi-jane-doe-report.pdf',
      reportMimeType: 'application/pdf',
      reportStorageKey: pdfFile,
      reportTemplateVersion: '3.0.0-old',
      result: result as unknown as EwiInvestigationResult,
    }).getReport('inv-1', 'user-1');

    expect(JSON.stringify(result)).toBe(before);
    expect(updateReportFile).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({
        fileName: 'ewi-jane-doe-report.pdf',
        templateVersion: EWI_REPORT_TEMPLATE_VERSION,
      }),
    );
  });

  it('rewrites a PDF saved with an older template in place', async () => {
    writeFileSync(pdfFile, 'older pdf');
    build.mockResolvedValue(rebuiltPdf('newer pdf'));

    const report = await service({
      reportFileName: 'ewi-jane-doe-report.pdf',
      reportMimeType: 'application/pdf',
      reportStorageKey: pdfFile,
      reportTemplateVersion: '3.0.0-old',
    }).getReport('inv-1', 'user-1');

    expect(report.buffer.toString()).toBe('newer pdf');
    expect(readFileSync(pdfFile, 'utf8')).toBe('newer pdf');
    expect(updateReportFile).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({ storageKey: pdfFile }),
    );
  });

  it('serves a current report as saved', async () => {
    writeFileSync(pdfFile, 'saved pdf');

    const report = await service({
      reportFileName: 'ewi-jane-doe-report.pdf',
      reportMimeType: 'application/pdf',
      reportStorageKey: pdfFile,
      reportTemplateVersion: EWI_REPORT_TEMPLATE_VERSION,
    }).getReport('inv-1', 'user-1');

    expect(build).not.toHaveBeenCalled();
    expect(report).toEqual({
      fileName: 'ewi-jane-doe-report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('saved pdf'),
    });
  });

  it('serves the saved Word file when the rebuild fails', async () => {
    build.mockRejectedValue(new Error('renderer failed'));

    const report = await service({ reportTemplateVersion: '1.0.0' }).getReport(
      'inv-1',
      'user-1',
    );

    expect(report).toEqual({
      fileName: 'ewi-report.docx',
      mimeType: WORD_MIME,
      buffer: Buffer.from('saved word report'),
    });
    expect(existsSync(wordFile)).toBe(true);
    expect(updateReportFile).not.toHaveBeenCalled();
  });

  it('saves a new report under its own extension', async () => {
    await service().markCompleted(
      'job-2',
      { expertName: 'Jane Doe' } as EwiInvestigationResult,
      rebuiltPdf('new pdf'),
    );

    const saved = join(root, 'investigations', 'job-2.pdf');
    expect(readFileSync(saved, 'utf8')).toBe('new pdf');
    expect(markCompleted).toHaveBeenCalledWith(
      'job-2',
      expect.anything(),
      expect.objectContaining({
        fileName: 'ewi-jane-doe-report.pdf',
        mimeType: 'application/pdf',
        storageKey: saved,
      }),
    );
  });
  it('exports a finished investigation as Word, built from the saved result', async () => {
    buildWord.mockResolvedValue({
      fileName: 'ewi-jane-doe-report.docx',
      mimeType: WORD_MIME,
      format: 'docx',
      buffer: Buffer.from('word report'),
    });

    const report = await service({ status: 'completed' }).getWordReport(
      'inv-1',
      'user-1',
    );

    expect(buildWord).toHaveBeenCalledWith(
      expect.objectContaining({ expertName: 'Jane Doe' }),
    );
    expect(report).toEqual({
      fileName: 'ewi-jane-doe-report.docx',
      mimeType: WORD_MIME,
      buffer: Buffer.from('word report'),
    });
    // Nothing is written: the PDF stays the stored copy.
    expect(updateReportFile).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
  });

  it('rebuilds stale stored questions on Word export without writing them back', async () => {
    buildWord.mockResolvedValue({
      fileName: 'ewi-jane-doe-report.docx',
      mimeType: WORD_MIME,
      format: 'docx',
      buffer: Buffer.from('word report'),
    });
    const staleQuestion = {
      number: 1,
      category: 'Background and credentials',
      question: 'Is every license in finding f1 current?',
      evidenceBasis: 'collected record',
      label: 'unresolved' as const,
      sources: [],
    };

    await service({
      status: 'completed',
      result: {
        expertName: 'Jane Doe',
        city: 'Boston',
        specialty: 'Neurology',
        evidence: [
          {
            sourceId: 'state_license',
            category: 'license',
            title: 'CA License',
            summary:
              'California psychologist license PSY12345 is active and was issued in 2009.',
            url: 'https://example.test/license',
            informationStatus: 'verified',
            identityMatch: 'matched',
            source: {
              providerId: 'state_license',
              name: 'California DCA',
              retrievedAt: '2026-10-01T00:00:00.000Z',
              access: 'public',
            },
          },
        ],
        discrepancies: [],
        questions: [staleQuestion],
        questionCount: 1,
        sourceStatuses: [],
        generatedAt: '2026-10-19T12:00:00.000Z',
      } as unknown as EwiInvestigationResult,
    }).getWordReport('inv-1', 'user-1');

    expect(buildWord).toHaveBeenCalledWith(
      expect.objectContaining({ expertName: 'Jane Doe' }),
    );
    expect(JSON.stringify(buildWord.mock.calls)).toMatch(/PSY12345/);
    expect(JSON.stringify(buildWord.mock.calls)).not.toMatch(/finding f1/i);
    expect(updateReportFile).not.toHaveBeenCalled();
  });

  it('does not export an investigation that has not finished', async () => {
    await expect(
      service({ status: 'running', result: null }).getWordReport(
        'inv-1',
        'user-1',
      ),
    ).rejects.toThrow(/no finished report/);
    expect(buildWord).not.toHaveBeenCalled();
  });

  it('exports unique source links as a PDF without writing the stored report', async () => {
    buildSourceLinks.mockResolvedValue({
      fileName: 'ewi-jane-doe-source-links.pdf',
      mimeType: 'application/pdf',
      format: 'pdf',
      buffer: Buffer.from('links pdf'),
      templateId: 'ewi/source-links',
      templateVersion: EWI_REPORT_TEMPLATE_VERSION,
    });

    const report = await service({ status: 'completed' }).getLinksReport(
      'inv-1',
      'user-1',
    );

    expect(buildSourceLinks).toHaveBeenCalledWith(
      expect.objectContaining({ expertName: 'Jane Doe' }),
    );
    expect(report).toEqual({
      fileName: 'ewi-jane-doe-source-links.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('links pdf'),
    });
    expect(updateReportFile).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    expect(buildWord).not.toHaveBeenCalled();
  });

  it('does not export source links for an investigation that has not finished', async () => {
    await expect(
      service({ status: 'running', result: null }).getLinksReport(
        'inv-1',
        'user-1',
      ),
    ).rejects.toThrow(/no finished report/);
    expect(buildSourceLinks).not.toHaveBeenCalled();
  });

  it('does not export source links for an investigation the caller does not own', async () => {
    await expect(
      service({ status: 'completed' }, { owned: false }).getLinksReport(
        'inv-1',
        'user-2',
      ),
    ).rejects.toThrow(/not found/);
    expect(buildSourceLinks).not.toHaveBeenCalled();
  });
});
