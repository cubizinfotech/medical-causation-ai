import {
  BadRequestException,
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
} from '@nestjs/common';
import { AiException } from '@ai/exceptions';
import { MedicalAnalysisService } from '../services';
import { MedicalAnalysisJobService } from '../jobs/medical-analysis-job.service';
import { AnalysisHistoryService } from '../services/analysis-history.service';
import { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import { mapCaseDtoToAnalysisRequest } from '../utils/case-request.mapper';
import { AnalysisResponseParseError } from '../utils/analysis-response.parser';
import {
  AnalysisSafetyException,
  InsufficientEvidenceException,
  MedicalAnalysisException,
} from '../exceptions';
import type { MedicalAnalysisResult } from '../types';
import type { MedicalAnalysisJobRecord } from '../jobs/medical-analysis-job.types';
import type { CreateMedicalAnalysisJobResponse } from '../jobs/medical-analysis-job.types';

@Controller('medical-analysis')
export class MedicalAnalysisController {
  private readonly logger = new Logger(MedicalAnalysisController.name);

  constructor(
    private readonly medicalAnalysisService: MedicalAnalysisService,
    private readonly jobService: MedicalAnalysisJobService,
    private readonly historyService: AnalysisHistoryService,
  ) {}

  @Get('histories')
  listHistories() {
    return this.historyService.listHistories();
  }

  @Get('histories/:id')
  getHistory(@Param('id') id: string) {
    return this.historyService.getHistory(id);
  }

  @Delete('histories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHistory(@Param('id') id: string): Promise<void> {
    await this.historyService.deleteHistory(id);
  }

  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async createJob(
    @Body() body: AnalyzeMedicalCaseDto,
  ): Promise<CreateMedicalAnalysisJobResponse> {
    try {
      return await this.jobService.enqueue(body);
    } catch (error) {
      return this.handleError(error);
    }
  }

  @Get('jobs/:jobId')
  async getJob(
    @Param('jobId') jobId: string,
  ): Promise<MedicalAnalysisJobRecord> {
    return this.jobService.getJob(jobId);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(
    @Body() body: AnalyzeMedicalCaseDto,
  ): Promise<MedicalAnalysisResult> {
    try {
      return await this.medicalAnalysisService.analyze(
        mapCaseDtoToAnalysisRequest(body),
      );
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
      if (error instanceof AnalysisSafetyException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InsufficientEvidenceException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof MedicalAnalysisException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof AnalysisResponseParseError) {
        this.logger.error(`Medical analysis parse error: ${error.message}`);
        throw new BadRequestException(
          'The AI model returned an invalid response. Please retry, or switch to a more reliable chat model in AI_CHAT_MODEL.',
        );
      }
      if (error instanceof AiException) {
        this.logger.error(`Medical analysis AI error: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      const message =
        error instanceof Error ? error.message : 'Unknown analysis error';
      this.logger.error(`Medical analysis failed: ${message}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException(
        'Medical analysis failed. Please try again.',
      );
  }
}
