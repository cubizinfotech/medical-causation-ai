import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import { AuditService } from '@platform/audit/audit.service';
import { downloadHeaders } from '@platform/http/download-headers';
import { UploadRateLimit } from '@platform/rate-limit/rate-limit';
import { caseRecordsConfig } from '@config/case-records.config';
import { CaseRecordsService } from './case-records.service';
import type {
  CaseRecordSummary,
  UploadedRecordFile,
} from './case-record.types';

type AuthedRequest = Request & { user?: AuthUserRef };

/** Client medical records for MCA cases (PDF, owner-only). */
@Controller('medical-analysis/records')
export class CaseRecordsController {
  constructor(
    private readonly records: CaseRecordsService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @UploadRateLimit()
  @UseInterceptors(
    FileInterceptor('file', {
      // Multer stops reading once the limit is passed (HTTP 413).
      limits: { fileSize: caseRecordsConfig().maxFileSizeBytes, files: 1 },
    }),
  )
  upload(
    @Req() request: AuthedRequest,
    @UploadedFile() file: UploadedRecordFile | undefined,
  ): Promise<CaseRecordSummary> {
    return this.records.upload(requireRequestUser(request).id, file);
  }

  @Get(':id/file')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireRequestUser(request).id;
    const { buffer, name } = await this.records.readFile(userId, id);
    void this.audit.record({
      product: 'mca',
      action: 'record.view',
      actorId: userId,
      resourceType: 'case_record',
      resourceId: id,
    });
    res.set(downloadHeaders(name, 'application/pdf', 'inline'));
    return new StreamableFile(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ): Promise<void> {
    await this.records.deleteStaged(requireRequestUser(request).id, id);
  }
}
