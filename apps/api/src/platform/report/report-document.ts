import type { ReportFormat } from './report.types';

/** Product-neutral section tree. MCA and EWI each build their own template. */
export interface ReportBlock {
  text: string;
  style?:
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'subheading'
    | 'body'
    | 'citation'
    | 'note';
  /** When set, the text is rendered as a hyperlink. */
  link?: string;
}

export interface ReportSectionModel {
  id: string;
  title: string;
  blocks: ReportBlock[];
}

export interface ReportDocumentModel {
  product: 'mca' | 'ewi';
  templateId: string;
  templateVersion: string;
  title: string;
  subtitle?: string;
  headerLabel: string;
  fileName: string;
  generatedAt: string;
  mimeType: string;
  format: ReportFormat;
  sections: ReportSectionModel[];
}
