/**
 * Common report infrastructure types.
 * Product modules (MCA PDF/HTML, EWI Word) implement builders against these shapes.
 */
export type ReportFormat = 'docx' | 'pdf' | 'html' | 'json';

export interface ReportArtifact {
  fileName: string;
  mimeType: string;
  format: ReportFormat;
  /** Raw bytes when generated server-side. */
  buffer?: Buffer;
  templateId?: string;
  templateVersion?: string;
}

export interface IReportBuilder<TInput> {
  build(input: TInput): Promise<ReportArtifact>;
}
