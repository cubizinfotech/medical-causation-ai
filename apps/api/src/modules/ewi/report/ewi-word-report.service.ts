import { Injectable } from '@nestjs/common';
import { DocxReportRenderer } from '@platform/report/docx/docx-report.renderer';
import type { ReportArtifact } from '@platform/report/report.types';
import type { EwiReportInput } from './ewi-pdf-report.service';
import { buildEwiReportDocument } from './ewi-report.template';

export interface EwiWordReportOutput extends ReportArtifact {
  buffer: Buffer;
  format: 'docx';
}

/**
 * The EWI investigation report as a Word file, from the same template as
 * the PDF. Built when it is exported; it is not stored.
 */
@Injectable()
export class EwiWordReportService {
  constructor(private readonly renderer: DocxReportRenderer) {}

  async build(input: EwiReportInput): Promise<EwiWordReportOutput> {
    const rendered = await this.renderer.render(buildEwiReportDocument(input));
    return { ...rendered, format: 'docx', buffer: rendered.buffer };
  }
}
