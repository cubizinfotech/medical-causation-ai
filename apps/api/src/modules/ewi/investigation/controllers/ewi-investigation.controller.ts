import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import { ExpertInvestigationService } from '../services/expert-investigation.service';
import { EwiInvestigationJobService } from '../jobs/ewi-investigation-job.service';
import { InvestigationHistoryService } from '../services/investigation-history.service';
import { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { CreateEwiInvestigationJobResponse } from '../jobs/ewi-investigation-job.types';
import type { EwiInvestigationJobRecord } from '../jobs/ewi-investigation-job.types';
import type { EwiInvestigationResult } from '../jobs/ewi-investigation-job.types';

@Controller('ewi')
export class EwiInvestigationController {
  private readonly logger = new Logger(EwiInvestigationController.name);

  constructor(
    private readonly investigationService: ExpertInvestigationService,
    private readonly jobService: EwiInvestigationJobService,
    private readonly historyService: InvestigationHistoryService,
  ) {}

  @Get('histories')
  listHistories(@Req() request: Request & { user?: AuthUserRef }) {
    return this.historyService.listHistories(requireRequestUser(request).id);
  }

  @Get('histories/:id')
  getHistory(
    @Param('id') id: string,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    return this.historyService.getHistory(id, requireRequestUser(request).id);
  }

  @Post('histories/:id/cancel')
  async cancelHistory(
    @Param('id') id: string,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    const view = await this.historyService.cancel(
      id,
      requireRequestUser(request).id,
    );
    if (view.jobId) {
      await this.jobService.markCancelled(view.jobId);
    }
    return view;
  }

  @Delete('histories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHistory(
    @Param('id') id: string,
    @Req() request: Request & { user?: AuthUserRef },
  ): Promise<void> {
    await this.historyService.deleteHistory(id, requireRequestUser(request).id);
  }

  @Get('histories/:id/report')
  async downloadReport(
    @Param('id') id: string,
    @Req() request: Request & { user?: AuthUserRef },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const report = await this.historyService.getReport(
      id,
      requireRequestUser(request).id,
    );
    res.set({
      'Content-Type': report.mimeType,
      'Content-Disposition': `attachment; filename="${report.fileName}"`,
    });
    return new StreamableFile(report.buffer);
  }

  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async createJob(
    @Body() body: CreateExpertInvestigationDto,
    @Req() request: Request & { user?: AuthUserRef },
  ): Promise<CreateEwiInvestigationJobResponse> {
    try {
      return await this.jobService.enqueue(
        body,
        requireRequestUser(request).id,
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get('jobs/:jobId')
  async getJob(
    @Param('jobId') jobId: string,
    @Req() request: Request & { user?: AuthUserRef },
  ): Promise<EwiInvestigationJobRecord> {
    await this.historyService.assertJobOwner(
      jobId,
      requireRequestUser(request).id,
    );
    return this.jobService.getJob(jobId);
  }

  @Post('investigate')
  @HttpCode(HttpStatus.OK)
  async investigate(
    @Body() body: CreateExpertInvestigationDto,
  ): Promise<EwiInvestigationResult> {
    // Sync path is for tests/tools only. Product UI must use POST /ewi/jobs.
    if (process.env.EWI_ALLOW_SYNC_INVESTIGATE !== 'true') {
      this.logger.warn(
        'Rejected sync /ewi/investigate. Use POST /ewi/jobs for async Redis/BullMQ execution.',
      );
      throw new InternalServerErrorException(
        'Synchronous investigation is disabled. Start an investigation with POST /ewi/jobs.',
      );
    }
    try {
      const outcome = await this.investigationService.investigate({
        expertName: body.expertName.trim(),
        city: body.city.trim(),
        specialty: body.specialty.trim(),
        ...(body.npi ? { npi: body.npi } : {}),
      });
      return outcome.result;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    const message =
      error instanceof Error ? error.message : 'Unknown investigation error';
    this.logger.error(
      `EWI investigation failed: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new InternalServerErrorException(
      'Expert witness investigation failed. Please try again.',
    );
  }
}
