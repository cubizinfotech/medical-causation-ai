import { BadRequestException, Injectable } from '@nestjs/common';
import { DocxReportRenderer } from '@platform/report/docx/docx-report.renderer';
import { AnalysisHistoryService } from '../services/analysis-history.service';
import { buildMcaReportDocument } from './mca-report.template';

export interface McaWordReport {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

/** The owner's finished causation analysis as a Word report. */
@Injectable()
export class McaWordReportService {
  constructor(
    private readonly history: AnalysisHistoryService,
    private readonly renderer: DocxReportRenderer,
  ) {}

  async build(id: string, ownerUserId: string): Promise<McaWordReport> {
    // Throws not found for another user's case.
    const detail = await this.history.getHistory(id, ownerUserId);
    if (detail.status !== 'completed' || !detail.result) {
      throw new BadRequestException(
        'The analysis must finish before its report can be exported.',
      );
    }
    const rendered = await this.renderer.render(
      buildMcaReportDocument({
        result: detail.result,
        caseDetails: {
          patientAge: detail.patientAge,
          patientGender: detail.patientGender,
          accidentDate: detail.accidentDate,
          accidentType: detail.accidentType,
          diagnosis: detail.diagnosis,
          medicalQuestion: detail.medicalQuestion,
        },
      }),
    );
    return {
      fileName: rendered.fileName,
      mimeType: rendered.mimeType,
      buffer: rendered.buffer,
    };
  }
}
