import { Injectable } from '@nestjs/common';
import { PdfReportRenderer } from '@platform/report/pdf/pdf-report.renderer';
import type { ReportArtifact } from '@platform/report/report.types';
import type {
  ExpertEvidenceItem,
  ExpertIdentityResolution,
} from '@integrations/expert-research';
import type { ExpertDiscrepancy } from '../research/discrepancy-analyzer';
import type { CrossExamQuestion } from '../research/cross-exam-question.generator';
import type { EwiAnalysisDocument } from '../investigation/analysis/ewi-analysis.types';
import type { LegalResearchDossier } from '../research/legal';
import type { OnlinePresenceDossier } from '../research/online-presence';
import type { ProfessionalBackgroundDossier } from '../research/professional-background';
import { buildEwiReportDocument } from './ewi-report.template';
import { buildEwiSourceLinksDocument } from './ewi-source-links';
import type { CvCheck } from '../cv/cv.types';
import type { WebResearchDossier } from '@integrations/web-research';
import type { ReportSourceStatus } from './ewi-report.template';

export interface EwiReportInput {
  expertName: string;
  city: string;
  specialty: string;
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
  questions: CrossExamQuestion[];
  generatedAt: string;
  summary?: string;
  analysis?: EwiAnalysisDocument;
  legalResearch?: LegalResearchDossier;
  onlinePresence?: OnlinePresenceDossier;
  professionalBackground?: ProfessionalBackgroundDossier;
  identity?: ExpertIdentityResolution | null;
  cvCheck?: CvCheck | null;
  /** Why CV comparison is present or omitted. */
  cvComparisonState?: 'compared' | 'not_uploaded' | 'not_read';
  /** Free text the attorney added to the intake form. */
  additionalContext?: string | null;
  /** Global web research: candidates, pages, coverage and limits. */
  webResearch?: WebResearchDossier | null;
  /** What each catalog source did, for the "not checked" lines of empty sections. */
  sourceStatuses?: ReportSourceStatus[];
  /** Shown when stored questions were rebuilt from current evidence. */
  questionsNote?: string;
}

export interface EwiReportOutput extends ReportArtifact {
  buffer: Buffer;
  format: 'pdf';
  templateId: string;
  templateVersion: string;
}

/** The EWI investigation report as a PDF, laid out like the MCA report. */
@Injectable()
export class EwiPdfReportService {
  constructor(private readonly renderer: PdfReportRenderer) {}

  async build(input: EwiReportInput): Promise<EwiReportOutput> {
    return this.renderModel(buildEwiReportDocument(input));
  }

  /**
   * A separate PDF of unique source URLs from the investigation record.
   * It is built on request and is not stored as the investigation report.
   */
  async buildSourceLinks(input: EwiReportInput): Promise<EwiReportOutput> {
    return this.renderModel(buildEwiSourceLinksDocument(input));
  }

  private async renderModel(
    model: ReturnType<typeof buildEwiReportDocument>,
  ): Promise<EwiReportOutput> {
    const rendered = await this.renderer.render(model);
    return {
      fileName: rendered.fileName,
      mimeType: rendered.mimeType,
      format: 'pdf',
      templateId: model.templateId,
      templateVersion: model.templateVersion,
      buffer: rendered.buffer,
    };
  }
}
