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
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
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
  listHistories() {
    return this.historyService.listHistories();
  }

  @Get('histories/:id')
  getHistory(@Param('id') id: string) {
    return this.historyService.getHistory(id);
  }

  @Post('histories/:id/cancel')
  cancelHistory(@Param('id') id: string) {
    return this.historyService.cancel(id);
  }

  @Delete('histories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHistory(@Param('id') id: string): Promise<void> {
    await this.historyService.deleteHistory(id);
  }

  @Get('histories/:id/report')
  async downloadReport(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const report = await this.historyService.getReport(id);
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
  ): Promise<CreateEwiInvestigationJobResponse> {
    try {
      return await this.jobService.enqueue(body);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get('jobs/:jobId')
  async getJob(
    @Param('jobId') jobId: string,
  ): Promise<EwiInvestigationJobRecord> {
    return this.jobService.getJob(jobId);
  }

  @Post('investigate')
  @HttpCode(HttpStatus.OK)
  async investigate(
    @Body() body: CreateExpertInvestigationDto,
  ): Promise<EwiInvestigationResult> {
    try {
      const outcome = await this.investigationService.investigate({
        expertName: body.expertName.trim(),
        specialty: body.specialty.trim(),
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
