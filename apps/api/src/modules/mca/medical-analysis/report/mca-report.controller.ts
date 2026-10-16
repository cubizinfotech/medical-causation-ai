import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import { AuditService } from '@platform/audit/audit.service';
import { downloadHeaders } from '@platform/http/download-headers';
import { McaWordReportService } from './mca-word-report.service';

@Controller('medical-analysis')
export class McaReportController {
  constructor(
    private readonly reports: McaWordReportService,
    private readonly audit: AuditService,
  ) {}

  /** The owner's finished analysis as a Word report. */
  @Get('histories/:id/report/word')
  async downloadWord(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user?: AuthUserRef },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireRequestUser(request).id;
    const report = await this.reports.build(id, userId);
    void this.audit.record({
      product: 'mca',
      action: 'report.download',
      actorId: userId,
      resourceType: 'analysis_case',
      resourceId: id,
      metadata: { format: 'docx' },
    });
    res.set(downloadHeaders(report.fileName, report.mimeType));
    return new StreamableFile(report.buffer);
  }
}
