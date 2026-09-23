import { Injectable } from '@nestjs/common';
import { DocxReportRenderer } from '@platform/report/docx-report.renderer';
import type { ReportArtifact } from '@platform/report/report.types';
import type { ExpertEvidenceItem } from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';
import type { EwiAnalysisDocument } from '../investigation/analysis/ewi-analysis.types';
import { buildEwiReportDocument } from './ewi-report.template';

export interface EwiReportInput {
  expertName: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
  questions: CrossExamQuestion[];
  generatedAt: string;
  summary?: string;
  analysis?: EwiAnalysisDocument;
}

export interface EwiReportOutput extends ReportArtifact {
  buffer: Buffer;
  format: 'docx';
  templateId: string;
  templateVersion: string;
}

@Injectable()
export class EwiWordReportService {
  constructor(private readonly renderer: DocxReportRenderer) {}

  async build(input: EwiReportInput): Promise<EwiReportOutput> {
    const model = buildEwiReportDocument(input);
    const rendered = await this.renderer.render(model);
    return {
      fileName: rendered.fileName,
      mimeType: rendered.mimeType,
      format: 'docx',
      templateId: model.templateId,
      templateVersion: model.templateVersion,
      buffer: rendered.buffer,
    };
  }
}
