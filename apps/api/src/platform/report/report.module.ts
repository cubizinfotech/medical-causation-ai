import { Module } from '@nestjs/common';
import { DocxReportRenderer } from './docx/docx-report.renderer';
import { PdfReportRenderer } from './pdf/pdf-report.renderer';

/** Shared report renderers. Product templates stay in MCA and EWI modules. */
@Module({
  providers: [PdfReportRenderer, DocxReportRenderer],
  exports: [PdfReportRenderer, DocxReportRenderer],
})
export class ReportModule {}
