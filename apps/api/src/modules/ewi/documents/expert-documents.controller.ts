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
import { ewiDocumentsConfig } from '@config/ewi-documents.config';
import { ExpertDocumentsService } from './expert-documents.service';
import type {
  ExpertDocumentSummary,
  UploadedExpertFile,
} from './expert-documents.types';

type AuthedRequest = Request & { user?: AuthUserRef };

/** Documents attorneys upload for an investigation (PDF, owner-only). */
@Controller('ewi/documents')
export class ExpertDocumentsController {
  constructor(
    private readonly documents: ExpertDocumentsService,
    private readonly audit: AuditService,
  ) {}

  /** The opposing expert's CV. */
  @Post('cv')
  @UploadRateLimit()
  @UseInterceptors(
    FileInterceptor('file', {
      // Multer stops reading once the limit is passed (HTTP 413).
      limits: { fileSize: ewiDocumentsConfig().maxFileSizeBytes, files: 1 },
    }),
  )
  uploadCv(
    @Req() request: AuthedRequest,
    @UploadedFile() file: UploadedExpertFile | undefined,
  ): Promise<ExpertDocumentSummary> {
    return this.documents.upload(requireRequestUser(request).id, file, 'cv');
  }

  @Get(':id/file')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireRequestUser(request).id;
    const { buffer, name } = await this.documents.readFile(userId, id);
    void this.audit.record({
      product: 'ewi',
      action: 'document.view',
      actorId: userId,
      resourceType: 'expert_document',
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
    await this.documents.deleteStaged(requireRequestUser(request).id, id);
  }
}
