import { Module } from '@nestjs/common';
import { DocxReportRenderer } from './docx-report.renderer';

/** Shared report renderer. Product templates stay in MCA and EWI modules. */
@Module({
  providers: [DocxReportRenderer],
  exports: [DocxReportRenderer],
})
export class ReportModule {}
