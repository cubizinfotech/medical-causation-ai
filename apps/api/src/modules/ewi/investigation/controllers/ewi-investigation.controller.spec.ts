import { StreamableFile, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { EwiInvestigationController } from './ewi-investigation.controller';
import type { EwiInvestigationJobService } from '../jobs/ewi-investigation-job.service';
import type { InvestigationHistoryService } from '../services/investigation-history.service';
import type { AuditService } from '@platform/audit/audit.service';

describe('EwiInvestigationController source-links export', () => {
  const buffer = Buffer.from('%PDF-links');
  const getLinksReport = jest.fn();
  const auditRecord = jest.fn();
  const controller = new EwiInvestigationController(
    {} as EwiInvestigationJobService,
    { getLinksReport } as unknown as InvestigationHistoryService,
    { record: auditRecord } as unknown as AuditService,
  );

  beforeEach(() => {
    getLinksReport.mockReset();
    auditRecord.mockReset();
    getLinksReport.mockResolvedValue({
      fileName: 'ewi-jane-doe-source-links.pdf',
      mimeType: 'application/pdf',
      buffer,
    });
  });

  it('exports source links for the signed-in owner and records the download', async () => {
    const set = jest.fn();
    const res = { set } as unknown as Response;
    const request = { user: { id: 'user-1' } } as unknown as Request;

    const file = await controller.downloadLinksReport(
      '11111111-1111-4111-8111-111111111111',
      request,
      res,
    );

    expect(getLinksReport).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'user-1',
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'ewi',
        action: 'report.download',
        actorId: 'user-1',
        resourceId: '11111111-1111-4111-8111-111111111111',
        metadata: { format: 'source-links' },
      }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
      }),
    );
    expect(file).toBeInstanceOf(StreamableFile);
  });

  it('rejects an unauthenticated request without building the PDF', async () => {
    const res = { set: jest.fn() } as unknown as Response;
    await expect(
      controller.downloadLinksReport(
        '11111111-1111-4111-8111-111111111111',
        {} as Request,
        res,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getLinksReport).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });
});
