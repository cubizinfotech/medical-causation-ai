import {
  BadRequestException,
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
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import { AuditService } from '@platform/audit/audit.service';
import { JobRateLimit } from '@platform/rate-limit/rate-limit';
import { AiException } from '@ai/exceptions';
import { MedicalAnalysisJobService } from '../jobs/medical-analysis-job.service';
import { AnalysisHistoryService } from '../services/analysis-history.service';
import { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import { MedicalAnalysisException } from '../exceptions';
import type { MedicalAnalysisJobRecord } from '../jobs/medical-analysis-job.types';
import type { CreateMedicalAnalysisJobResponse } from '../jobs/medical-analysis-job.types';

type AuthedRequest = Request & { user?: AuthUserRef };

@Controller('medical-analysis')
export class MedicalAnalysisController {
  private readonly logger = new Logger(MedicalAnalysisController.name);

  constructor(
    private readonly jobService: MedicalAnalysisJobService,
    private readonly historyService: AnalysisHistoryService,
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
      product: 'mca',
      action: 'analysis.view',
      actorId: userId,
      resourceType: 'analysis_case',
      resourceId: id,
    });
    return history;
  }

  @Delete('histories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ): Promise<void> {
    const userId = requireRequestUser(request).id;
    await this.historyService.deleteHistory(id, userId);
    void this.audit.record({
      product: 'mca',
      action: 'analysis.delete',
      actorId: userId,
      resourceType: 'analysis_case',
      resourceId: id,
    });
  }

  @Post('jobs')
  @JobRateLimit()
  @HttpCode(HttpStatus.ACCEPTED)
  async createJob(
    @Body() body: AnalyzeMedicalCaseDto,
    @Req() request: AuthedRequest,
  ): Promise<CreateMedicalAnalysisJobResponse> {
    try {
      return await this.jobService.enqueue(
        body,
        requireRequestUser(request).id,
      );
    } catch (error) {
      return this.handleError(error);
    }
  }

  @Get('jobs/:jobId')
  async getJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() request: AuthedRequest,
  ): Promise<MedicalAnalysisJobRecord> {
    await this.historyService.assertJobOwner(
      jobId,
      requireRequestUser(request).id,
    );
    return this.jobService.getJob(jobId);
  }

  private handleError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof MedicalAnalysisException) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof AiException) {
      this.logger.error(`Medical analysis AI error: ${error.message}`);
      throw new BadRequestException(error.message);
    }
    this.logger.error(
      `Medical analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new InternalServerErrorException(
      'Medical analysis could not be started. Please try again.',
    );
  }
}
