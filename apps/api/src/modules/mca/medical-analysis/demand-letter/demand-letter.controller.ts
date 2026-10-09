import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import { CreateDemandLetterDto } from './create-demand-letter.dto';
import { DOCX_MIME, DemandLetterService } from './demand-letter.service';

@Controller('medical-analysis')
export class DemandLetterController {
  constructor(private readonly letters: DemandLetterService) {}

  /** A draft demand letter (Word) for the owner's finished analysis. */
  @Post('histories/:id/demand-letter')
  @HttpCode(HttpStatus.OK)
  async create(
    @Param('id') id: string,
    @Body() dto: CreateDemandLetterDto,
    @Req() request: Request & { user?: AuthUserRef },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const letter = await this.letters.build(
      id,
      requireRequestUser(request).id,
      dto,
    );
    res.set({
      'Content-Type': DOCX_MIME,
      'Content-Disposition': `attachment; filename="${letter.fileName}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(letter.buffer);
  }
}
