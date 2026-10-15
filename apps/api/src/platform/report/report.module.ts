import { Module } from '@nestjs/common';
import { PdfReportRenderer } from './pdf/pdf-report.renderer';

/** Shared report renderer. Product templates stay in MCA and EWI modules. */
@Module({
  providers: [PdfReportRenderer],
  exports: [PdfReportRenderer],
})
export class ReportModule {}
