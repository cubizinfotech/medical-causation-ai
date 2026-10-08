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
  constructor(private readonly records: CaseRecordsService) {}

  @Post()
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
    const { buffer, name } = await this.records.readFile(
      requireRequestUser(request).id,
      id,
    );
    const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
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
