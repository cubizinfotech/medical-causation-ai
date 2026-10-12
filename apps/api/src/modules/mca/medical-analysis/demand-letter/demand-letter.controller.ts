import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import { AuditService } from '@platform/audit/audit.service';
import { downloadHeaders } from '@platform/http/download-headers';
import { JobRateLimit } from '@platform/rate-limit/rate-limit';
import { CreateDemandLetterDto } from './create-demand-letter.dto';
import { DOCX_MIME, DemandLetterService } from './demand-letter.service';

@Controller('medical-analysis')
export class DemandLetterController {
  constructor(
    private readonly letters: DemandLetterService,
    private readonly audit: AuditService,
  ) {}

  /** A draft demand letter (Word) for the owner's finished analysis. */
  @Post('histories/:id/demand-letter')
  @JobRateLimit()
  @HttpCode(HttpStatus.OK)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDemandLetterDto,
    @Req() request: Request & { user?: AuthUserRef },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireRequestUser(request).id;
    const letter = await this.letters.build(id, userId, dto);
    void this.audit.record({
      product: 'mca',
      action: 'demand_letter.download',
      actorId: userId,
      resourceType: 'analysis_case',
      resourceId: id,
    });
    res.set(downloadHeaders(letter.fileName, DOCX_MIME));
    return new StreamableFile(letter.buffer);
  }
}
