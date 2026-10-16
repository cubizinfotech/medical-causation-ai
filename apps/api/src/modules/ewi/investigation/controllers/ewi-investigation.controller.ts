import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
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
import { EwiInvestigationJobService } from '../jobs/ewi-investigation-job.service';
import { InvestigationHistoryService } from '../services/investigation-history.service';
import { CreateExpertInvestigationDto } from '../dto/create-expert-investigation.dto';
import type { CreateEwiInvestigationJobResponse } from '../jobs/ewi-investigation-job.types';
import type { EwiInvestigationJobRecord } from '../jobs/ewi-investigation-job.types';

type AuthedRequest = Request & { user?: AuthUserRef };

@Controller('ewi')
export class EwiInvestigationController {
  private readonly logger = new Logger(EwiInvestigationController.name);

  constructor(
    private readonly jobService: EwiInvestigationJobService,
    private readonly historyService: InvestigationHistoryService,
    private readonly audit: AuditService,
  ) {}

  @Get('histories')
  listHistories(@Req() request: AuthedRequest) {
    return this.historyService.listHistories(requireRequestUser(request).id);
  }

  @Get('histories/:id')
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    const userId = requireRequestUser(request).id;
    const history = await this.historyService.getHistory(id, userId);
    void this.audit.record({
      product: 'ewi',
      action: 'investigation.view',
      actorId: userId,
      resourceType: 'investigation',
      resourceId: id,
    });
    return history;
  }

  @Post('histories/:id/cancel')
  async cancelHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
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
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ): Promise<void> {
    const userId = requireRequestUser(request).id;
    const { jobId } = await this.historyService.deleteHistory(id, userId);
    // A running job sees the investigation is gone and stops.
    await this.jobService.deleteJobRecord(jobId);
    void this.audit.record({
      product: 'ewi',
      action: 'investigation.delete',
      actorId: userId,
      resourceType: 'investigation',
      resourceId: id,
    });
  }

  @Get('histories/:id/report')
  async downloadReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireRequestUser(request).id;
    const report = await this.historyService.getReport(id, userId);
    void this.audit.record({
      product: 'ewi',
      action: 'report.download',
      actorId: userId,
      resourceType: 'investigation',
      resourceId: id,
    });
    res.set(downloadHeaders(report.fileName, report.mimeType));
    return new StreamableFile(report.buffer);
  }

  /** The same report as a Word file, built from the saved investigation. */
  @Get('histories/:id/report/word')
  async downloadWordReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireRequestUser(request).id;
    const report = await this.historyService.getWordReport(id, userId);
    void this.audit.record({
      product: 'ewi',
      action: 'report.download',
      actorId: userId,
      resourceType: 'investigation',
      resourceId: id,
      metadata: { format: 'docx' },
    });
    res.set(downloadHeaders(report.fileName, report.mimeType));
    return new StreamableFile(report.buffer);
  }

  @Post('jobs')
  @JobRateLimit()
  @HttpCode(HttpStatus.ACCEPTED)
  async createJob(
    @Body() body: CreateExpertInvestigationDto,
    @Req() request: AuthedRequest,
  ): Promise<CreateEwiInvestigationJobResponse> {
    try {
      return await this.jobService.enqueue(
        body,
        requireRequestUser(request).id,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `EWI investigation could not be started: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Expert witness investigation could not be started. Please try again.',
      );
    }
  }

  @Get('jobs/:jobId')
  async getJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() request: AuthedRequest,
  ): Promise<EwiInvestigationJobRecord> {
    await this.historyService.assertJobOwner(
      jobId,
      requireRequestUser(request).id,
    );
    return this.jobService.getJob(jobId);
  }
}
