import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { AiException } from '@ai/exceptions';
import { MedicalAnalysisService } from '../services';
import { AnalyzeMedicalCaseDto } from '../dto/analyze-medical-case.dto';
import { mapCaseDtoToAnalysisRequest } from '../utils/case-request.mapper';
import {
  AnalysisSafetyException,
  InsufficientEvidenceException,
  MedicalAnalysisException,
} from '../exceptions';
import type { MedicalAnalysisResult } from '../types';

@Controller('medical-analysis')
export class MedicalAnalysisController {
  private readonly logger = new Logger(MedicalAnalysisController.name);

  constructor(
    private readonly medicalAnalysisService: MedicalAnalysisService,
  ) {}

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
      if (error instanceof AnalysisSafetyException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InsufficientEvidenceException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof MedicalAnalysisException) {
        throw new BadRequestException(error.message);
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
}
