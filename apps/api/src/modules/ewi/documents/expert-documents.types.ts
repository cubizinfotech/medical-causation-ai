/** Kinds of documents an attorney uploads for an investigation. */
export type ExpertDocumentKind = 'cv';

/** The multer file shape this module reads (memory storage). */
export interface UploadedExpertFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** What the upload endpoint returns to the intake form. */
export interface ExpertDocumentSummary {
  id: string;
  kind: ExpertDocumentKind;
  name: string;
  sizeBytes: number;
  pageCount: number;
  /** Pages with usable text now. */
  readablePages: number;
  /** Pages that will not be read: blank, or scanned when OCR is off. */
  unreadablePages: number[];
  /** Scanned pages that will be read with OCR when the investigation runs. */
  ocrPendingPages: number[];
  createdAt: string;
}

export interface ExpertDocumentPageText {
  pageNumber: number;
  text: string;
  ocrConfidence: number | null;
}

/** A document with its page text, as the investigation reads it. */
export interface LoadedExpertDocument {
  id: string;
  kind: ExpertDocumentKind;
  name: string;
  pageCount: number;
  unreadablePages: number[];
  ocrPages: number[];
  pages: ExpertDocumentPageText[];
}
