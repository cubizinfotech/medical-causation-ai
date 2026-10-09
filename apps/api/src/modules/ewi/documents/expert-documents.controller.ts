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
  constructor(private readonly documents: ExpertDocumentsService) {}

  /** The opposing expert's CV. */
  @Post('cv')
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
    const { buffer, name } = await this.documents.readFile(
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
    await this.documents.deleteStaged(requireRequestUser(request).id, id);
  }
}
