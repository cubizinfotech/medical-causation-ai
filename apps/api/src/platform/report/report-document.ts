import type { ReportFormat } from './report.types';

/** Product-neutral section tree. MCA and EWI each build their own template. */
export interface ReportBlock {
  text: string;
  /**
   * 'subheading' opens a boxed record with a bold title, and 'item' a boxed
   * entry in regular text (a question, a source). The blocks after either
   * belong to that box until the next box opens or the section ends.
   */
  style?:
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'subheading'
    | 'item'
    | 'body'
    | 'citation'
    | 'note';
  /** When set, the text is rendered as a hyperlink. */
  link?: string;
}

/** Icons the PDF renderer can draw in a section header (Lucide shapes). */
export type ReportIconName =
  | 'alert-triangle'
  | 'award'
  | 'badge-check'
  | 'banknote'
  | 'book-open'
  | 'book-user'
  | 'briefcase'
  | 'building'
  | 'clipboard-list'
  | 'coins'
  | 'file-text'
  | 'fingerprint'
  | 'gavel'
  | 'git-compare'
  | 'globe'
  | 'graduation-cap'
  | 'landmark'
  | 'layers'
  | 'lightbulb'
  | 'link'
  | 'list'
  | 'list-checks'
  | 'map-pin'
  | 'medal'
  | 'megaphone'
  | 'message-square-warning'
  | 'mic'
  | 'newspaper'
  | 'scale'
  | 'school'
  | 'scroll-text'
  | 'share'
  | 'shield-alert'
  | 'star'
  | 'user'
  | 'users'
  | 'video';

export interface ReportSectionModel {
  id: string;
  title: string;
  blocks: ReportBlock[];
  /** Icon in the section's header. */
  icon?: ReportIconName;
  /**
   * Where the section appears: a card in the report body (default), one
   * value in the cover's details ('cover-fact', its first block), or the
   * summary text on the cover ('cover-summary').
   */
  placement?: 'card' | 'cover-fact' | 'cover-summary';
}

export interface ReportDocumentMetadata {
  expertName?: string;
  city?: string;
  specialty?: string;
  investigationDate?: string;
  reportVersion?: string;
  templateId?: string;
  product?: string;
  disclaimer?: string;
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
  /** When true, a contents list with page numbers follows the cover. */
  includeTableOfContents?: boolean;
  /** Short facts shown as badges on the cover, e.g. "12 questions". */
  highlights?: string[];
  metadata?: ReportDocumentMetadata;
}
