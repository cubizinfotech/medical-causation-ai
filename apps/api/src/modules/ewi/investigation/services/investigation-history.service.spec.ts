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
  const buildWord = jest.fn();

  function service(row: Partial<InvestigationView> = {}) {
    return new InvestigationHistoryService(
      {
        findOwned: () =>
          Promise.resolve({
            id: 'inv-1',
            reportFileName: 'ewi-report.docx',
            reportMimeType: WORD_MIME,
            reportStorageKey: wordFile,
            result: { expertName: 'Jane Doe' } as EwiInvestigationResult,
            ...row,
          }),
        findByJobId: () => Promise.resolve({ id: 'inv-2' }),
        updateReportFile,
        markCompleted,
      } as unknown as ExpertInvestigationRepository,
      {
        get: () => ({ products: { ewi: { reports: root } } }),
      } as unknown as ConfigService,
      {} as EwiRequestWorkflowService,
      {} as ExpertDocumentsService,
      { build } as unknown as EwiPdfReportService,
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

  it('does not export an investigation that has not finished', async () => {
    await expect(
      service({ status: 'running', result: null }).getWordReport(
        'inv-1',
        'user-1',
      ),
    ).rejects.toThrow(/no finished report/);
    expect(buildWord).not.toHaveBeenCalled();
  });
});
